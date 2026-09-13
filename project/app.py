import os
import time
import json
import pickle
import urllib.request
import urllib.parse
import numpy as np
from flask import Flask, request, jsonify, render_template, send_from_directory
import tensorflow as tf

# Suppress TensorFlow logging
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

app = Flask(__name__, static_folder='static', template_folder='templates')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PKL_PATH = os.path.join(BASE_DIR, 'recommender_data.pkl')
RECOMMENDER_MODEL_PATH = os.path.join(BASE_DIR, 'ncf_movie_recommender.keras')
CLASSIFIER_MODEL_PATH = os.path.join(BASE_DIR, 'ncf_movie_classifier.keras')
CATALOG_PATH = os.path.join(BASE_DIR, 'data', 'movies_catalog.json')
POSTERS_CACHE_PATH = os.path.join(BASE_DIR, 'data', 'posters_cache.json')

recommender_data = None
model_recommender = None
model_classifier = None
movies_catalog = {}
posters_cache = {}
candidate_movie_ids = []
candidate_movie_indices = []

def clean_movie_title(title):
    t = (title or '').strip()
    if ' (a.k.a. ' in t:
        t = t.split(' (a.k.a. ')[0]
    if ' (' in t and ')' in t:
        parts = t.split(' (')
        if len(parts) == 2 and not any(char.isdigit() for char in parts[1]):
            t = parts[0]
            
    if t.endswith(', The'):
        t = 'The ' + t[:-5]
    elif t.endswith(', A'):
        t = 'A ' + t[:-3]
    elif t.endswith(', An'):
        t = 'An ' + t[:-4]
    return t.strip()

print("[System] Initializing Machine Learning Models & Metadata...")
try:
    with open(PKL_PATH, 'rb') as f:
        recommender_data = pickle.load(f)
    print(f"[System] Loaded recommender_data.pkl: {len(recommender_data['user_to_index'])} users, {len(recommender_data['movie_to_index'])} movies.")
except Exception as e:
    print(f"[Error] Failed to load recommender_data.pkl: {e}")

try:
    with open(CATALOG_PATH, 'r', encoding='utf-8') as f:
        movies_catalog = json.load(f)
    print(f"[System] Loaded movies_catalog.json: {len(movies_catalog)} catalog titles.")
except Exception as e:
    print(f"[Error] Failed to load movies_catalog.json: {e}")

def load_posters_cache():
    global posters_cache
    if os.path.exists(POSTERS_CACHE_PATH):
        try:
            with open(POSTERS_CACHE_PATH, 'r', encoding='utf-8') as f:
                posters_cache = json.load(f)
            print(f"[System] Loaded posters cache: {len(posters_cache)} titles cached.")
        except Exception as e:
            print(f"[Warning] Could not load posters cache: {e}")

load_posters_cache()

try:
    model_recommender = tf.keras.models.load_model(RECOMMENDER_MODEL_PATH)
    print("[System] Loaded NCF Recommender (ncf_movie_recommender.keras) successfully.")
except Exception as e:
    print(f"[Error] Failed to load NCF Recommender: {e}")

try:
    model_classifier = tf.keras.models.load_model(CLASSIFIER_MODEL_PATH)
    print("[System] Loaded NCF Classifier (ncf_movie_classifier.keras) successfully.")
except Exception as e:
    print(f"[Error] Failed to load NCF Classifier: {e}")

if recommender_data and movies_catalog:
    m2i = recommender_data['movie_to_index']
    for mid_str in movies_catalog.keys():
        mid = int(mid_str)
        if mid in m2i:
            candidate_movie_ids.append(mid)
            candidate_movie_indices.append(m2i[mid])
    candidate_movie_indices = np.array(candidate_movie_indices, dtype=np.int32)
    candidate_movie_ids = np.array(candidate_movie_ids, dtype=np.int32)
    print(f"[System] Pre-indexed {len(candidate_movie_ids)} candidate items for high-performance vectorized inference.")

# Evaluation Metrics Data for the About & Model Performance Page
METRICS_DATA = {
    "model_comparison": [
        {
            "metric": "RMSE",
            "full_name": "Root Mean Squared Error",
            "svd": 0.9123,
            "ncf": 0.9043,
            "improvement_pct": 0.88,
            "better": "NCF",
            "description": "Standard deviation of error residuals on the MovieLens test split. NCF achieves 0.9043 vs SVD 0.9123."
        },
        {
            "metric": "MAE",
            "full_name": "Mean Absolute Error",
            "svd": 0.6989,
            "ncf": 0.6912,
            "improvement_pct": 1.09,
            "better": "NCF",
            "description": "Average absolute rating deviation. NCF predicts true user satisfaction to within 0.69 stars."
        },
        {
            "metric": "MSE",
            "full_name": "Mean Squared Error",
            "svd": 0.8323,
            "ncf": 0.8177,
            "improvement_pct": 1.76,
            "better": "NCF",
            "description": "Mean squared error metric across held-out evaluation pairs. NCF reduces MSE from 0.8323 to 0.8177."
        }
    ],
    "top_n_results": {
        "precision_at_10": 0.0060,
        "recall_at_10": 0.0600,
        "hit_rate_at_10": 0.0600
    },
    "project_info": {
        "title": "Movie Recommendation System",
        "subtitle": "Collaborative Filtering and Deep Neural Architectures",
        "dataset": "MovieLens Latest",
        "total_users": 328894,
        "total_movies": 79145,
        "catalog_curated": 3000,
        "architecture": "GMF (Generalized Matrix Factorization) + MLP (Multi-Layer Perceptron) NeuMF"
    }
}

@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
    return response

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        "status": "online",
        "recommender_loaded": model_recommender is not None,
        "classifier_loaded": model_classifier is not None,
        "users_count": len(recommender_data['user_to_index']) if recommender_data else 0,
        "movies_count": len(recommender_data['movie_to_index']) if recommender_data else 0,
        "catalog_size": len(movies_catalog)
    })

@app.route('/api/metrics', methods=['GET'])
def get_metrics():
    return jsonify({
        "success": True,
        "data": METRICS_DATA
    })


@app.route('/api/movies/search', methods=['GET'])
def search_movies():
    query = request.args.get('q', '').strip().lower()
    limit = min(int(request.args.get('limit', 20)), 50)
    
    results = []
    if not query:
        sample_keys = list(movies_catalog.keys())[:limit]
        for mid_str in sample_keys:
            m_info = movies_catalog[mid_str]
            p_info = posters_cache.get(mid_str, {})
            results.append({
                "movie_id": m_info['id'],
                "title": clean_movie_title(m_info['title']),
                "raw_title": m_info['title'],
                "year": m_info.get('year', ''),
                "genres": m_info.get('genres', []),
                "rating_count": m_info.get('rating_count', 0),
                "poster_url": p_info.get('poster'),
                "synopsis": p_info.get('synopsis', '')
            })
        return jsonify({"success": True, "results": results})
        
    for mid_str, m_info in movies_catalog.items():
        title_lower = m_info['title'].lower()
        cleaned_lower = clean_movie_title(m_info['title']).lower()
        full_lower = m_info.get('full_title', '').lower()
        
        if query in title_lower or query in cleaned_lower or query in full_lower:
            p_info = posters_cache.get(mid_str, {})
            results.append({
                "movie_id": m_info['id'],
                "title": clean_movie_title(m_info['title']),
                "raw_title": m_info['title'],
                "year": m_info.get('year', ''),
                "genres": m_info.get('genres', []),
                "rating_count": m_info.get('rating_count', 0),
                "poster_url": p_info.get('poster'),
                "synopsis": p_info.get('synopsis', '')
            })
            if len(results) >= limit:
                break
                
    return jsonify({"success": True, "results": results})

@app.route('/api/predict', methods=['POST'])
def predict_movie():
    """
    Pointwise prediction for a specific movie and user.
    Used by movie search details and quick preview modals.
    """
    data = request.get_json() or {}
    
    try:
        user_id = int(data.get('user_id', 252136))
        movie_id = int(data.get('movie_id', 318))
    except (ValueError, TypeError):
        return jsonify({"success": False, "error": "Invalid user or movie ID parameters."}), 400

    u2i = recommender_data['user_to_index']
    m2i = recommender_data['movie_to_index']
    
    if user_id not in u2i:
        return jsonify({
            "success": False,
            "error": "User not found. Please enter a valid MovieLens User ID."
        }), 404

    if movie_id not in m2i:
        return jsonify({
            "success": False,
            "error": f"Movie ID {movie_id} is not in the model catalog."
        }), 404

    user_idx = u2i[user_id]
    movie_idx = m2i[movie_id]
    
    m_info = movies_catalog.get(str(movie_id), {
        "id": movie_id,
        "title": f"Movie #{movie_id}",
        "year": "",
        "genres": ["Drama"],
        "rating_count": 0
    })
    p_info = posters_cache.get(str(movie_id), {})

    user_arr = np.array([user_idx], dtype=np.int32)
    movie_arr = np.array([movie_idx], dtype=np.int32)

    predicted_rating = 4.0
    match_percentage = 80
    relevance_prob = 80.0
    is_relevant = True

    if model_recommender:
        raw_pred = float(model_recommender.predict([user_arr, movie_arr], verbose=0)[0][0])
        bounded = max(1.0, min(5.0, raw_pred))
        predicted_rating = round(bounded, 2)
        match_percentage = int(round((bounded / 5.0) * 100))

    if model_classifier:
        prob = float(model_classifier.predict([user_arr, movie_arr], verbose=0)[0][0])
        relevance_prob = round(prob * 100, 1)
        is_relevant = prob >= 0.5

    return jsonify({
        "success": True,
        "movie_id": movie_id,
        "user_id": user_id,
        "title": clean_movie_title(m_info['title']),
        "raw_title": m_info['title'],
        "year": m_info.get('year', ''),
        "genres": m_info.get('genres', []),
        "rating_count": m_info.get('rating_count', 0),
        "predicted_rating": predicted_rating,
        "match_percentage": match_percentage,
        "relevance_probability": relevance_prob,
        "is_relevant": is_relevant,
        "poster_url": p_info.get('poster'),
        "synopsis": p_info.get('synopsis', '')
    })

@app.route('/api/recommend', methods=['POST'])
def recommend_movies():
    """
    Top-N Recommendation Generator using the existing NCF neural model.
    Validates user ID, excludes candidates as needed, and returns attractive movie cards.
    """
    data = request.get_json() or {}
    
    user_id_raw = data.get('user_id')
    if user_id_raw is None or str(user_id_raw).strip() == '':
        return jsonify({
            "success": False,
            "error": "Please enter a valid MovieLens User ID."
        }), 400

    try:
        user_id = int(user_id_raw)
    except (ValueError, TypeError):
        return jsonify({
            "success": False,
            "error": "Invalid User ID format. Please enter numbers only."
        }), 400

    u2i = recommender_data['user_to_index']
    if user_id not in u2i:
        return jsonify({
            "success": False,
            "error": "User not found. Please enter a valid MovieLens User ID."
        }), 404

    top_n = min(int(data.get('top_n', 10)), 30)
    genre_filter = data.get('genre', 'All').strip()
    sort_by = data.get('sort_by', 'recommended').lower()

    user_idx = u2i[user_id]
    
    # Filter candidates by genre if requested
    if genre_filter and genre_filter.lower() != 'all':
        filtered_ids = []
        filtered_indices = []
        g_lower = genre_filter.lower()
        for mid, idx in zip(candidate_movie_ids, candidate_movie_indices):
            m_info = movies_catalog.get(str(mid))
            if m_info and g_lower in [g.lower() for g in m_info.get('genres', [])]:
                filtered_ids.append(mid)
                filtered_indices.append(idx)
        cur_ids = np.array(filtered_ids, dtype=np.int32)
        cur_indices = np.array(filtered_indices, dtype=np.int32)
    else:
        cur_ids = candidate_movie_ids
        cur_indices = candidate_movie_indices

    if len(cur_indices) == 0:
        return jsonify({
            "success": True,
            "user_id": user_id,
            "genre": genre_filter,
            "recommendations": [],
            "message": f"No titles found for genre '{genre_filter}'."
        })

    user_arr = np.full(len(cur_indices), user_idx, dtype=np.int32)

    # Use existing NCF Recommender for rating predictions
    preds = model_recommender.predict([user_arr, cur_indices], batch_size=1024, verbose=0).flatten()

    # Sort candidates
    top_indices = np.argsort(preds)[-top_n:][::-1]

    recommendations = []
    for rank, idx in enumerate(top_indices, 1):
        mid = int(cur_ids[idx])
        score = float(preds[idx])
        bounded_rating = max(1.0, min(5.0, score))
        
        m_info = movies_catalog.get(str(mid), {
            "id": mid,
            "title": f"Movie #{mid}",
            "year": "",
            "genres": ["General"],
            "rating_count": 0
        })
        
        p_info = posters_cache.get(str(mid), {})
        
        recommendations.append({
            "rank": rank,
            "movie_id": mid,
            "title": clean_movie_title(m_info['title']),
            "raw_title": m_info['title'],
            "year": m_info.get('year', ''),
            "genres": m_info.get('genres', []),
            "predicted_rating": round(bounded_rating, 2),
            "match_percentage": int(round((bounded_rating / 5.0) * 100)),
            "rating_count": m_info.get('rating_count', 0),
            "poster_url": p_info.get('poster'),
            "synopsis": p_info.get('synopsis', '')
        })

    return jsonify({
        "success": True,
        "user_id": user_id,
        "genre_filter": genre_filter,
        "top_n": top_n,
        "recommendations": recommendations
    })

@app.route('/api/poster', methods=['GET'])
def get_movie_poster():
    """
    On-demand poster lookup with Wikipedia REST API and cache persistence.
    """
    movie_id_str = request.args.get('movie_id')
    title = request.args.get('title', '').strip()
    year = request.args.get('year', '').strip()

    if movie_id_str and movie_id_str in posters_cache:
        return jsonify({"success": True, "data": posters_cache[movie_id_str]})

    if not title:
        return jsonify({"success": False, "error": "Missing title"}), 400

    # On-demand Wikipedia lookup
    cleaned = clean_movie_title(title)
    candidates = [
        cleaned,
        f"{cleaned} ({year} film)" if year else f"{cleaned} (film)",
        f"{cleaned} film",
        f"{cleaned} (TV series)"
    ]
    
    headers = {'User-Agent': 'MovieRecApp/2.0 (Movie Recommendation Demo; contact: demo@movierec.edu)'}
    
    result = None
    for cand in candidates[:3]:
        slug = cand.replace(' ', '_')
        url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{urllib.parse.quote(slug)}"
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=3) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                thumb = data.get('thumbnail', {}).get('source')
                extract = data.get('extract', '')
                if thumb:
                    result = {"poster": thumb, "synopsis": extract}
                    break
        except Exception:
            continue

    if result:
        if movie_id_str:
            posters_cache[movie_id_str] = result
            # Save asynchronously or periodically
            try:
                with open(POSTERS_CACHE_PATH, 'w', encoding='utf-8') as f:
                    json.dump(posters_cache, f, indent=2)
            except Exception:
                pass
        return jsonify({"success": True, "data": result})

    return jsonify({"success": False, "error": "Poster not found"}), 404

@app.route('/plots/<path:filename>')
def serve_plot(filename):
    return send_from_directory(os.path.join(BASE_DIR, 'static', 'plots'), filename)

if __name__ == '__main__':
    print("[Server] Starting MovieRec Server on http://127.0.0.1:5000")
    app.run(host='0.0.0.0', port=5000, debug=False)
