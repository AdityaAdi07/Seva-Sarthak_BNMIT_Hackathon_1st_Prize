import joblib, shap
import numpy as np
model = joblib.load("models/rf_crowd_model.pkl")
explainer = shap.TreeExplainer(model)
features = np.array([[18, 5, 1, 0, 0, 2000]])
sv = explainer.shap_values(features)
print(type(sv))
if hasattr(sv, 'shape'):
    print(sv.shape)
elif isinstance(sv, list):
    print("List, length:", len(sv))
print(sv)
