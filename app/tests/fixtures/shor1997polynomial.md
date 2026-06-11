---
id: shor1997polynomial
title: "Polynomial-Time Algorithms for Prime Factorization and Discrete Logarithms on a Quantum Computer"
authors: ["Shor, Peter W."]
year: 1997
venue: "SIAM Journal on Computing"
doi: "10.1137/S0097539795293172"
url: "https://arxiv.org/abs/quant-ph/9508027"
tags: ["量子計算", "アルゴリズム"]
liked: true
status: read
added_at: 2026-06-04T21:10:00Z
updated_at: 2026-06-06T10:00:00Z
---

## Abstract
This paper shows that prime factorization and discrete logarithms, problems generally considered hard on a classical computer, can be solved in polynomial time on a hypothetical quantum computer. The algorithms exploit quantum parallelism and the quantum Fourier transform, and their existence has major implications for the security of widely used public-key cryptosystems.

## Notes
量子フーリエ変換の周期発見への帰着が本体。位数発見 → 因数分解の古典的還元はユークリッド互除法だけで済むのが美しい。

RSAへの含意のところは、鍵長の話と合わせてセキュリティ系の輪講資料に使えそう。連分数展開の精度評価(定理5.1)は再導出しておく。
