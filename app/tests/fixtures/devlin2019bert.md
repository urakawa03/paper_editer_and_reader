---
id: devlin2019bert
title: "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding"
authors: ["Devlin, Jacob", "Chang, Ming-Wei", "Lee, Kenton", "Toutanova, Kristina"]
year: 2019
venue: "NAACL"
doi: "10.18653/v1/N19-1423"
url: "https://aclanthology.org/N19-1423/"
tags: ["機械学習", "NLP", "事前学習"]
liked: false
status: reading
added_at: 2026-06-02T09:30:00Z
updated_at: 2026-06-02T09:30:00Z
---

## Abstract
BERT is a language representation model that pre-trains deep bidirectional representations from unlabeled text by jointly conditioning on both left and right context. The pre-trained model can be fine-tuned with one additional output layer to obtain strong results on a wide range of tasks, including question answering and language inference, without substantial task-specific architecture modifications.

## Notes
masked LM と next sentence prediction の2タスクで事前学習。GLUEの結果表は後で精読する。
