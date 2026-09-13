import urllib.request
import json

def test_api():
    print("Testing multi-model prediction endpoints...")
    # 1. Health
    with urllib.request.urlopen('http://127.0.0.1:5000/api/health') as resp:
        health = json.loads(resp.read().decode('utf-8'))
        print(f"Health: Recommender={health['recommender_loaded']}, Classifier={health['classifier_loaded']}, Catalog={health['catalog_size']}")

    # 2. Predict with Model Switching: 'all'
    req = urllib.request.Request(
        'http://127.0.0.1:5000/api/predict',
        data=json.dumps({"user_id": 252136, "movie_id": 318, "model_type": "all"}).encode('utf-8'),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        pred = json.loads(resp.read().decode('utf-8'))
        print(f"\n[Single Predict Comparison for '{pred['title']}']")
        print(f" -> NCF Recommender Rating: {pred['ncf_recommender']['predicted_rating']} stars ({pred['ncf_recommender']['match_percentage']}%)")
        print(f" -> NCF Classifier Relevance: {pred['ncf_classifier']['relevance_probability']}% -> {pred['ncf_classifier']['classification']}")
        print(f" -> SVD Baseline Rating: {pred['svd_baseline']['predicted_rating']} stars ({pred['svd_baseline']['match_percentage']}%)")
        print(f" -> Inference Latency: {pred['latency_ms']}ms")

    # 3. Recommend with Model Switching: 'classifier' vs 'recommender'
    for mtype in ['recommender', 'classifier']:
        req = urllib.request.Request(
            'http://127.0.0.1:5000/api/recommend',
            data=json.dumps({"user_id": 252136, "top_n": 3, "genre": "All", "model_type": mtype}).encode('utf-8'),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req) as resp:
            rec = json.loads(resp.read().decode('utf-8'))
            print(f"\n[Top 3 Ranked with {rec['model_used']}] (Latency: {rec['latency_ms']}ms)")
            for r in rec['recommendations']:
                print(f"  #{r['rank']}: {r['title']} -> {r['score_label']}")

if __name__ == '__main__':
    test_api()
