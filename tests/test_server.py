import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "app"))
import server
import tempfile
import unittest
import threading
import urllib.request
import urllib.error
import json
from unittest.mock import patch, Mock


class CRMTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / "crm.db"
        self.store = server.Store(self.path)
        self.admin = self.store.create_user(
            {
                "name": "Admin",
                "email": "admin@example.com",
                "password": "password-for-tests",
            },
            bootstrap=True,
        )

    def tearDown(self):
        self.tmp.cleanup()

    def brand(self):
        return self.store.save("brands", {"name": "Brand test"}, self.admin)

    def test_login_and_expiration(self):
        login = self.store.login(
            {"email": "admin@example.com", "password": "password-for-tests"}
        )
        self.assertEqual(self.store.auth(login["token"])["id"], self.admin["id"])
        with self.store.db() as db:
            db.execute("UPDATE sessions SET expires=0")
        with self.assertRaises(server.Problem):
            self.store.auth(login["token"])

    def test_wrong_password_and_setup_replay(self):
        with self.assertRaises(server.Problem):
            self.store.login({"email": "admin@example.com", "password": "wrong"})
        with self.assertRaises(server.Problem):
            self.store.create_user(
                {
                    "name": "Other",
                    "email": "other@example.com",
                    "password": "other-password12",
                },
                bootstrap=True,
            )

    def test_persistence_and_concurrent_update(self):
        b = self.brand()
        updated = self.store.save(
            "brands", dict(b, name="New name"), self.admin, b["id"]
        )
        self.assertEqual(updated["version"], 2)
        with self.assertRaises(server.Problem) as err:
            self.store.save("brands", b, self.admin, b["id"])
        self.assertEqual(err.exception.status, 409)
        self.assertEqual(server.Store(self.path).all("brands")[0]["name"], "New name")

    def test_references_and_delete_protection(self):
        b = self.brand()
        p = self.store.save(
            "products",
            {"name": "Product", "brand_id": b["id"], "price": 100000, "commission": 15},
            self.admin,
        )
        with self.assertRaises(server.Problem):
            self.store.delete("brands", b["id"], b["version"], self.admin)
        with self.assertRaises(server.Problem):
            self.store.save(
                "deals",
                {"name": "Deal", "product_id": "unknown", "stage": "Chưa liên hệ"},
                self.admin,
            )
        self.store.delete("products", p["id"], p["version"], self.admin)
        self.store.delete("brands", b["id"], b["version"], self.admin)
        self.assertEqual(self.store.all("brands"), [])

    def test_product_brand_mismatch(self):
        b1 = self.brand()
        b2 = self.store.save("brands", {"name": "Second"}, self.admin)
        p = self.store.save("products", {"name": "P", "brand_id": b1["id"]}, self.admin)
        with self.assertRaises(server.Problem):
            self.store.save(
                "deals",
                {
                    "name": "D",
                    "brand_id": b2["id"],
                    "product_id": p["id"],
                    "stage": "Nhận mẫu",
                },
                self.admin,
            )

    def test_product_reassignment_keeps_deal_consistent(self):
        b1 = self.brand()
        b2 = self.store.save("brands", {"name": "B2"}, self.admin)
        p = self.store.save("products", {"name": "P", "brand_id": b1["id"]}, self.admin)
        self.store.save(
            "deals",
            {
                "name": "D",
                "brand_id": b1["id"],
                "product_id": p["id"],
                "stage": "Nhận mẫu",
            },
            self.admin,
        )
        with self.assertRaises(server.Problem):
            self.store.save("products", dict(p, brand_id=b2["id"]), self.admin, p["id"])

    def test_unknown_values_not_zero(self):
        p = self.store.save(
            "products", {"name": "P", "price": "", "commission": ""}, self.admin
        )
        self.assertIsNone(p["price"])
        self.assertIsNone(p["commission"])

    def test_input_validation(self):
        for data in (
            {"name": "P", "commission": 101},
            {"name": "P", "price": -1},
            {"name": "P", "price": "nan"},
            {"name": "P", "url": "javascript:alert(1)"},
            {"name": "P", "observed_at": "2026-99-99"},
        ):
            with self.assertRaises(server.Problem):
                self.store.save("products", data, self.admin)
        with self.assertRaises(server.Problem):
            self.store.save("deals", {"name": "D", "stage": "unknown"}, self.admin)

    def test_shell_arguments_are_not_executed(self):
        devices = server.Devices()
        with patch.object(
            devices, "status", return_value={"scrcpy": True, "devices": []}
        ):
            with patch("server.subprocess.Popen") as popen:
                with self.assertRaises(server.Problem):
                    devices.open("x; touch /tmp/evil")
                popen.assert_not_called()

    def test_scrcpy_uses_bundled_adb(self):
        devices = server.Devices()
        fake = Mock()
        fake.poll.return_value = None
        with patch.object(
            devices, "binary", side_effect=lambda name: "/bundled/" + name
        ), patch.object(
            devices,
            "status",
            return_value={
                "scrcpy": True,
                "devices": [{"serial": "ABC", "state": "device"}],
            },
        ), patch(
            "server.subprocess.Popen", return_value=fake
        ) as popen, patch(
            "server.time.sleep"
        ):
            self.assertTrue(devices.open("ABC")["opened"])
            self.assertEqual(popen.call_args.kwargs["env"]["ADB"], "/bundled/adb")
            self.assertEqual(popen.call_args.args[0][0], "/bundled/scrcpy")

    def test_bootstrap_stdout_is_utf8_even_with_legacy_encoding(self):
        import subprocess

        command = "import sys;sys.path.insert(0,sys.argv.pop(1));import server;sys.stdout.reconfigure(encoding='ascii');server.Server.serve_forever=lambda self:None;server.main()"
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                command,
                str(Path(__file__).resolve().parents[1] / "app"),
                "--port",
                "0",
                "--data",
                str(Path(self.tmp.name) / "encoding.sqlite3"),
            ],
            capture_output=True,
            timeout=20,
        )
        self.assertEqual(
            result.returncode, 0, result.stderr.decode("utf-8", errors="replace")
        )
        self.assertIn("Mã thiết lập quản trị viên:", result.stdout.decode("utf-8"))

    def test_device_parser(self):
        devices = server.Devices()
        with patch.object(devices, "binary", return_value="/tools/adb"), patch(
            "server.subprocess.run",
            return_value=Mock(
                returncode=0,
                stdout="List of devices attached\nABC device product:foo model:Pixel_8\nXYZ unauthorized\n",
            ),
        ):
            status = devices.status()
            self.assertEqual(status["devices"][0]["model"], "Pixel_8")
            self.assertEqual(status["devices"][1]["state"], "unauthorized")


class HTTPTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = server.Store(Path(self.tmp.name) / "db")
        self.http = server.Server(("127.0.0.1", 0), self.store)
        self.thread = threading.Thread(target=self.http.serve_forever, daemon=True)
        self.thread.start()
        self.base = "http://127.0.0.1:" + str(self.http.server_port)
        self.token = ""

    def tearDown(self):
        self.http.shutdown()
        self.http.server_close()
        self.thread.join()
        self.tmp.cleanup()

    def call(self, path, method="GET", data=None, headers=None):
        req = urllib.request.Request(
            self.base + path,
            method=method,
            data=json.dumps(data).encode() if data is not None else None,
            headers={
                "Content-Type": "application/json",
                "Authorization": "Bearer " + self.token,
                **(headers or {}),
            },
        )
        try:
            with urllib.request.urlopen(req) as res:
                return res.status, json.load(res)
        except urllib.error.HTTPError as e:
            return e.code, json.load(e)

    def login(self):
        self.call(
            "/api/setup",
            "POST",
            {
                "name": "A",
                "email": "a@example.com",
                "password": "test-password-123",
                "setup_token": self.http.setup_token,
            },
        )
        self.token = self.call(
            "/api/login",
            "POST",
            {"email": "a@example.com", "password": "test-password-123"},
        )[1]["token"]

    def test_bootstrap_and_auth_boundary(self):
        self.assertEqual(self.call("/api/workspace")[0], 401)
        self.assertEqual(
            self.call("/api/setup", "POST", {"setup_token": "invalid"})[0], 403
        )
        self.login()
        self.assertEqual(self.call("/api/workspace")[0], 200)
        self.assertEqual(
            self.call("/api/brands", "POST", {"name": "Shared brand"})[0], 201
        )
        self.assertEqual(len(self.call("/api/workspace")[1]["brands"]), 1)
        self.call("/api/logout", "POST", {})
        self.assertEqual(self.call("/api/workspace")[0], 401)

    def test_roles_and_shared_workspace(self):
        self.login()
        self.call("/api/brands", "POST", {"name": "Brand"})
        status, user = self.call(
            "/api/users",
            "POST",
            {
                "name": "Member",
                "email": "m@example.com",
                "password": "member-password",
                "role": "member",
            },
        )
        self.assertEqual(status, 201)
        self.token = self.call(
            "/api/login",
            "POST",
            {"email": "m@example.com", "password": "member-password"},
        )[1]["token"]
        self.assertEqual(self.call("/api/users", "POST", {"name": "X"})[0], 403)
        self.assertEqual(self.call("/api/audit")[0], 403)
        self.assertEqual(self.call("/api/workspace")[1]["brands"][0]["name"], "Brand")
        self.assertEqual(
            self.call("/api/products", "POST", {"name": "Product"})[0], 201
        )

    def test_cors_and_rebinding(self):
        self.assertEqual(
            self.call("/api/status", headers={"Origin": "https://evil.example"})[0], 403
        )
        self.assertEqual(
            self.call("/api/status", headers={"Host": "evil.example"})[0], 403
        )

    def test_proxy_host_allowlist(self):
        self.http.allowed_hosts.add("crm.example.com")
        self.assertEqual(
            self.call(
                "/api/status",
                headers={
                    "Host": "crm.example.com",
                    "Origin": "https://crm.example.com",
                },
            )[0],
            200,
        )
        self.assertEqual(
            self.call(
                "/api/status",
                headers={"Host": "crm.example.com", "Origin": "https://evil.example"},
            )[0],
            403,
        )

    def test_ai_disabled_and_template(self):
        self.login()
        with patch.dict(server.os.environ, {"OPENAI_API_KEY": "", "OPENAI_MODEL": ""}):
            self.assertEqual(self.call("/api/draft", "POST", {"mode": "ai"})[0], 503)
        status, result = self.call(
            "/api/draft", "POST", {"mode": "template", "kind": "Xin mẫu"}
        )
        self.assertEqual(status, 200)
        self.assertEqual(result["mode"], "template")
        self.assertIn("hoa hồng", result["body"])

    def test_ai_response_mapping(self):
        self.login()
        fake = Mock()
        fake.__enter__ = Mock(return_value=fake)
        fake.__exit__ = Mock(return_value=False)
        fake.read.return_value = json.dumps(
            {
                "output": [
                    {
                        "type": "message",
                        "content": [
                            {"type": "output_text", "text": "Bản nháp thử nghiệm"}
                        ],
                    }
                ]
            }
        ).encode()
        with patch.dict(
            server.os.environ, {"OPENAI_API_KEY": "test", "OPENAI_MODEL": "test-model"}
        ), patch("server.urllib.request.urlopen", return_value=fake) as mocked:
            # Call handler through HTTP without mocking the client's urllib.
            import http.client

            conn = http.client.HTTPConnection("127.0.0.1", self.http.server_port)
            conn.request(
                "POST",
                "/api/draft",
                json.dumps({"mode": "ai"}),
                {
                    "Authorization": "Bearer " + self.token,
                    "Content-Type": "application/json",
                },
            )
            response = conn.getresponse()
            body = json.loads(response.read())
            conn.close()
            self.assertEqual(response.status, 200)
            self.assertEqual(body["body"], "Bản nháp thử nghiệm")
            request = mocked.call_args[0][0]
            payload = json.loads(request.data)
            self.assertFalse(payload["store"])
            self.assertEqual(request.full_url, "https://api.openai.com/v1/responses")

    def test_password_change_revokes_sessions(self):
        self.login()
        old_token = self.token
        self.assertEqual(
            self.call(
                "/api/password",
                "POST",
                {"current_password": "wrong", "new_password": "new-password-123"},
            )[0],
            403,
        )
        self.assertEqual(
            self.call(
                "/api/password",
                "POST",
                {
                    "current_password": "test-password-123",
                    "new_password": "new-password-123",
                },
            )[0],
            200,
        )
        self.assertEqual(self.call("/api/workspace")[0], 401)
        self.assertEqual(
            self.call(
                "/api/login",
                "POST",
                {"email": "a@example.com", "password": "test-password-123"},
            )[0],
            401,
        )
        self.assertEqual(
            self.call(
                "/api/login",
                "POST",
                {"email": "a@example.com", "password": "new-password-123"},
            )[0],
            200,
        )

    def test_desktop_shutdown_requires_private_token(self):
        self.http.control_token = "private-control-token"
        devices = Mock()
        self.http.devices = devices
        self.assertEqual(self.call("/internal/shutdown", "POST", {})[0], 403)
        devices.close.assert_not_called()
        status, _ = self.call(
            "/internal/shutdown",
            "POST",
            {},
            {"Authorization": "Bearer private-control-token"},
        )
        self.assertEqual(status, 200)
        devices.close.assert_called_once()

    def test_bridge_token_required(self):
        bridge = server.Server(("127.0.0.1", 0), None, server.Devices(), "secret-token")
        thread = threading.Thread(target=bridge.serve_forever, daemon=True)
        thread.start()
        try:
            import http.client

            conn = http.client.HTTPConnection("127.0.0.1", bridge.server_port)
            conn.request("GET", "/api/devices")
            res = conn.getresponse()
            res.read()
            self.assertEqual(res.status, 401)
            conn.close()
        finally:
            bridge.shutdown()
            bridge.server_close()
            thread.join()


if __name__ == "__main__":
    unittest.main()
