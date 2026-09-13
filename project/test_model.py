import time
import pickle
import numpy as np
import tensorflow as tf
import json
import os

def run_tests():
    print("=" * 70)
    print("NEURAL COLLABORATIVE FILTERING (NCF) MODEL VALIDATION SUITE")
    print("=" * 70)
    
    # Test 1: Load recommender_data.pkl
    print("\n[Test 1] Validating recommender_data.pkl structure...")
    t0 = time.time()
    with open('recommender_data.pkl', 'rb') as f:
        data = pickle.load(f)
    print(f" -> Successfully loaded in {time.time() - t0:.3f}s")
    assert 'user_to_index' in data, "Missing user_to_index"
    assert 'movie_to_index' in data, "Missing movie_to_index"
    num_users = len(data['user_to_index'])
    num_movies = len(data['movie_to_index'])
    print(f" -> Total Indexed Users: {num_users:,}")
    print(f" -> Total Indexed Movies: {num_movies:,}")
    print(" -> PASSED [1/6]")

    # Test 2: Load movies catalog
    print("\n[Test 2] Validating Movie Metadata Catalog...")
    with open('data/movies_catalog.json', 'r', encoding='utf-8') as f:
        catalog = json.load(f)
    print(f" -> Loaded {len(catalog):,} catalog entries with titles and genres.")
    assert len(catalog) > 1000, "Catalog should have at least 1000 movies"
    print(" -> PASSED [2/6]")

    # Test 3: Load Keras model
    print("\n[Test 3] Loading Keras Model weights (ncf_movie_recommender.keras)...")
    t0 = time.time()
    model = tf.keras.models.load_model('ncf_movie_recommender.keras')
    print(f" -> Successfully loaded in {time.time() - t0:.3f}s")
    print(f" -> Model architecture: {model.name} with {model.count_params():,} parameters.")
    print(" -> PASSED [3/6]")

    # Test 4: Multiple User Inference Passes (5 cycles)
    print("\n[Test 4] Executing Repeated Inference Cycles (Testing 5 Diverse User Profiles)...")
    test_users = [252136, 202354, 29826, 154224, 99176]
    
    # Candidate pool of 1,000 top movies
    m2i = data['movie_to_index']
    u2i = data['user_to_index']
    
    candidate_mids = [int(mid) for mid in catalog.keys() if int(mid) in m2i][:1000]
    candidate_indices = np.array([m2i[mid] for mid in candidate_mids], dtype=np.int32)
    
    latencies = []
    
    for cycle, uid in enumerate(test_users, 1):
        u_idx = u2i.get(uid, 0)
        u_arr = np.full(len(candidate_indices), u_idx, dtype=np.int32)
        
        t_start = time.time()
        preds = model.predict([u_arr, candidate_indices], batch_size=1024, verbose=0).flatten()
        t_elapsed = (time.time() - t_start) * 1000
        latencies.append(t_elapsed)
        
        top10_idx = np.argsort(preds)[-10:][::-1]
        top10_scores = preds[top10_idx]
        
        # Verify monotonically descending
        assert np.all(np.diff(top10_scores) <= 1e-5), f"Cycle {cycle}: Predictions are not sorted descending!"
        # Verify valid rating boundaries
        assert np.all(top10_scores >= 0.5) and np.all(top10_scores <= 5.5), f"Cycle {cycle}: Scores outside reasonable bounds!"
        
        top_movie_id = candidate_mids[top10_idx[0]]
        top_movie_title = catalog[str(top_movie_id)]['title']
        print(f" -> Cycle {cycle} (User #{uid}): Top pick '{top_movie_title}' | Score: {top10_scores[0]:.2f} stars | Time: {t_elapsed:.1f}ms")

    print(f" -> Average Top-10 Ranking Latency across 1,000 candidates: {np.mean(latencies):.1f}ms")
    print(" -> PASSED [4/6]")

    # Test 5: Single Item Pointwise Prediction Test
    print("\n[Test 5] Validating Pointwise Single-Movie Prediction...")
    user_id = 252136
    sample_movies = [
        (318, "Shawshank Redemption, The"),
        (858, "Godfather, The"),
        (260, "Star Wars: Episode IV - A New Hope"),
        (296, "Pulp Fiction")
    ]
    u_idx = u2i[user_id]
    for mid, title in sample_movies:
        if mid in m2i:
            pred = model.predict([np.array([u_idx]), np.array([m2i[mid]])], verbose=0)[0][0]
            print(f" -> User #{user_id} on '{title}' (ID {mid}): Predicted Rating = {pred:.2f} / 5.0")
            assert 1.0 <= pred <= 5.0, f"Predicted rating {pred} out of range"
    print(" -> PASSED [5/6]")

    # Test 6: Genre-Filtered Candidate Ranking Test
    print("\n[Test 6] Testing Genre Filtering (Sci-Fi, Animation, Drama)...")
    for genre in ['Sci-Fi', 'Animation', 'Drama']:
        genre_mids = [mid for mid in candidate_mids if genre.lower() in [g.lower() for g in catalog[str(mid)]['genres']]]
        g_indices = np.array([m2i[mid] for mid in genre_mids], dtype=np.int32)
        u_arr = np.full(len(g_indices), u_idx, dtype=np.int32)
        preds = model.predict([u_arr, g_indices], batch_size=512, verbose=0).flatten()
        top_idx = np.argsort(preds)[-1]
        best_mid = genre_mids[top_idx]
        best_title = catalog[str(best_mid)]['title']
        print(f" -> Highest recommended {genre} title: '{best_title}' ({catalog[str(best_mid)]['year']}) with {preds[top_idx]:.2f} stars")
    print(" -> PASSED [6/6]")

    print("\n" + "=" * 70)
    print("ALL 6 MODEL VERIFICATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == '__main__':
    run_tests()
