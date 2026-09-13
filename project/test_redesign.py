import urllib.request
import urllib.error
import json

def test(name, url, method='GET', body=None):
    print(f"\n=== Testing: {name} ===")
    req = urllib.request.Request(url, method=method)
    if body:
        req.data = json.dumps(body).encode('utf-8')
        req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            print("Status: 200 OK | Success:", data.get('success'))
            return data
    except urllib.error.HTTPError as e:
        print(f"HTTP Error {e.code}: {e.read().decode('utf-8')}")
        return None

def run_suite():
    # 1. Genuine NCF Recommendations for User 252136
    r1 = test('NCF Model Recommendations (User 252136)', 'http://127.0.0.1:5000/api/recommend', 'POST', {
        'user_id': 252136,
        'top_n': 5,
        'genre': 'All'
    })
    if r1:
        print(f"Generated {len(r1['recommendations'])} genuine model predictions:")
        for m in r1['recommendations']:
            print(f" #{m['rank']}: {m['title']} ({m['year']}) -> {m['predicted_rating']} stars ({m['match_percentage']}%) | Poster: {bool(m['poster_url'])}")

    # 2. Genuine NCF Recommendations for User 202354 (Sci-Fi filter)
    r2 = test('NCF Sci-Fi Genre Recommendations (User 202354)', 'http://127.0.0.1:5000/api/recommend', 'POST', {
        'user_id': 202354,
        'top_n': 3,
        'genre': 'Sci-Fi'
    })
    if r2:
        for m in r2['recommendations']:
            print(f" #{m['rank']}: {m['title']} ({m['year']}) -> {m['predicted_rating']} stars | Genres: {m['genres']}")

    # 3. Invalid User Rejection
    test('Invalid User Rejection', 'http://127.0.0.1:5000/api/recommend', 'POST', {'user_id': 99999999})

    # 4. Search Query
    s = test('Catalog Search ("Pulp Fiction")', 'http://127.0.0.1:5000/api/movies/search?q=pulp+fiction')
    if s:
        for m in s['results'][:2]:
            print(f" -> Match: {m['title']} ({m['year']})")

    # 5. Pointwise Model Prediction
    p = test('Pointwise Model Inference (User 252136 on Movie 296 - Pulp Fiction)', 'http://127.0.0.1:5000/api/predict', 'POST', {
        'user_id': 252136,
        'movie_id': 296
    })
    if p:
        print(f" -> {p['title']}: {p['predicted_rating']} / 5.0 stars | Match: {p['match_percentage']}% | Relevant: {p['is_relevant']}")

if __name__ == '__main__':
    run_suite()
