import urllib.request
import json

def test():
    req = urllib.request.urlopen("http://127.0.0.1:8001/api/v1/suspects/S001")
    s1 = json.loads(req.read().decode())
    print("S001 API Response:")
    print(json.dumps(s1, indent=2))

    req = urllib.request.urlopen("http://127.0.0.1:8001/api/v1/suspects/S004")
    s4 = json.loads(req.read().decode())
    print("\nS004 API Response:")
    print(json.dumps(s4, indent=2))

if __name__ == "__main__":
    test()
