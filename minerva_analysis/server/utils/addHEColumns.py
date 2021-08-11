#%%
import pandas as pd

data = pd.read_csv('./unmicst-WD-76845-097-ij_subtracted_50.csv', encoding="utf-8-sig")
data.head()
#%%
data['HE_r'] = 0
data['HE_g'] = 0
data['HE_b'] = 0
data.columns
#%%
data.to_csv('./unmicst-WD-76845-097-ij_subtracted_50-jj.csv', index=False)
#%%
