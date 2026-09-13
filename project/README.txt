
MOVIE RECOMMENDATION SYSTEM
============================

Project:
Movie Recommendation System Using Collaborative Filtering and Deep Learning

Dataset:
MovieLens Latest

Models:
1. SVD - Singular Value Decomposition
2. NCF - Neural Collaborative Filtering

NCF Architecture:
GMF + MLP

Rating Prediction Results:
SVD MSE  : 0.8323
NCF MSE  : 0.8177

SVD RMSE : 0.9123
NCF RMSE : 0.9043

SVD MAE  : 0.6989
NCF MAE  : 0.6912

Top-N Recommendation Results:
Precision@10 : 0.0060
Recall@10    : 0.0600
Hit Rate@10  : 0.0600

Files:
01_SVD_vs_NCF_Performance.png
02_NCF_Training_Validation_Loss.png
03_NCF_Training_Validation_MAE.png
04_Confusion_Matrix.png
05_Model_Results.csv
06_Top_N_Results.csv
ncf_movie_recommender.keras
recommender_data.pkl
