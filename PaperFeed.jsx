import React, { useState, useMemo } from "react";

// ---- サンプルデータ（実在論文タイトル + AI要約風の説明文はモック用に自作） ----
const PAPERS = [
  {
    id: 1,
    title: "Attention Is All You Need",
    authors: "Vaswani, Shazeer, Parmar 他",
    year: 2017,
    venue: "NeurIPS",
    tags: ["機械学習", "Transformer", "NLP"],
    summary:
      "再帰も畳み込みも使わず、アテンション機構だけで系列変換を行うTransformerを提案。並列計算が効くため学習が高速で、翻訳タスクで当時の最高精度を更新した。現在の大規模言語モデルの土台になった一本。",
    read: true,
    liked: true,
  },
  {
    id: 2,
    title: "Observation of Gravitational Waves from a Binary Black Hole Merger",
    authors: "Abbott 他 (LIGO)",
    year: 2016,
    venue: "Phys. Rev. Lett.",
    tags: ["物理", "重力波", "観測"],
    summary:
      "二つのブラックホール合体が放つ重力波を史上初めて直接検出。アインシュタインの一般相対論から100年越しの予言を実証した。信号の波形から両天体の質量と距離を推定している。",
    read: false,
    liked: false,
  },
  {
    id: 3,
    title: "Equation of State Calculations by Fast Computing Machines",
    authors: "Metropolis, Rosenbluth 他",
    year: 1953,
    venue: "J. Chem. Phys.",
    tags: ["物理", "シミュレーション", "モンテカルロ"],
    summary:
      "後に「メトロポリス法」と呼ばれるマルコフ連鎖モンテカルロの原型を示した古典。確率分布に従うサンプリングを乱数で実現し、計算物理・統計力学のシミュレーション手法の出発点になった。",
    read: false,
    liked: true,
  },
  {
    id: 4,
    title: "Deep Residual Learning for Image Recognition",
    authors: "He, Zhang, Ren, Sun",
    year: 2015,
    venue: "CVPR",
    tags: ["機械学習", "画像認識", "深層学習"],
    summary:
      "層を深くすると精度が落ちる劣化問題を、残差接続(skip connection)で解決。152層という当時破格の深さを安定して学習でき、画像認識の精度を一気に押し上げた。",
    read: true,
    liked: false,
  },
  {
    id: 5,
    title: "Molecular Dynamics Simulation of Protein Folding",
    authors: "Shaw 他",
    year: 2010,
    venue: "Science",
    tags: ["シミュレーション", "生物物理", "分子動力学"],
    summary:
      "専用計算機を用い、ミリ秒スケールの分子動力学シミュレーションでタンパク質の折りたたみ過程を直接観察。実験では捉えにくい中間状態の構造変化を時間分解で可視化した。",
    read: false,
    liked: false,
  },
];

const ALL_TAGS = ["物理", "シミュレーション", "機械学習", "Transformer", "深層学習", "重力波", "モンテカルロ", "分子動力学", "NLP", "画像認識", "観測", "生物物理"];

export default function PaperFeed() {
  const [papers, setPapers] = useState(PAPERS);
  const [query, setQuery] = useState("");
  const [activeTags, setActiveTags] = useState([]);
  const [expanded, setExpanded] = useState({});

  const toggleLike = (id) =>
    setPapers((p) => p.map((x) => (x.id === id ? { ...x, liked: !x.liked } : x)));
  const toggleRead = (id) =>
    setPapers((p) => p.map((x) => (x.id === id ? { ...x, read: !x.read } : x)));
  const toggleExpand = (id) => setExpanded((e) => ({ ...e, [id]: !e[id] }));
  const toggleTag = (t) =>
    setActiveTags((a) => (a.includes(t) ? a.filter((x) => x !== t) : [...a, t]));

  const filtered = useMemo(() => {
    return papers.filter((p) => {
      const matchTags = activeTags.every((t) => p.tags.includes(t)); // AND 検索
      const q = query.trim().toLowerCase();
      const matchQuery =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.authors.toLowerCase().includes(q) ||
        p.summary.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q));
      return matchTags && matchQuery;
    });
  }, [papers, query, activeTags]);

  return (
    <div className="paperfeed-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,800&family=Newsreader:opsz,wght@6..72,400;6..72,500&family=Archivo:wght@400;500;600&display=swap');

        .paperfeed-root {
          --paper: #f6f1e7;
          --paper-2: #fffdf8;
          --ink: #1d1a17;
          --ink-soft: #5a534a;
          --line: #e3dac8;
          --accent: #c0432a;
          --accent-soft: #f3e0d9;
          min-height: 100vh;
          background:
            radial-gradient(120% 80% at 50% -10%, #fbf7ee 0%, var(--paper) 60%),
            var(--paper);
          font-family: 'Archivo', sans-serif;
          color: var(--ink);
          display: flex;
          justify-content: center;
          padding: 0;
        }
        .pf-phone {
          width: 100%;
          max-width: 430px;
          min-height: 100vh;
          background: var(--paper);
          border-left: 1px solid var(--line);
          border-right: 1px solid var(--line);
          position: relative;
        }
        .pf-header {
          position: sticky; top: 0; z-index: 10;
          padding: 18px 18px 12px;
          background: linear-gradient(180deg, var(--paper) 70%, rgba(246,241,231,0));
          backdrop-filter: blur(2px);
        }
        .pf-brand {
          display: flex; align-items: baseline; gap: 9px; margin-bottom: 14px;
        }
        .pf-logo {
          font-family: 'Fraunces', serif; font-weight: 800; font-size: 26px;
          letter-spacing: -0.02em; color: var(--ink); line-height: 1;
        }
        .pf-logo .dot { color: var(--accent); }
        .pf-tagline {
          font-size: 10.5px; color: var(--ink-soft); letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .pf-search {
          width: 100%; box-sizing: border-box;
          padding: 11px 14px; border-radius: 13px;
          border: 1px solid var(--line); background: var(--paper-2);
          font-family: 'Archivo', sans-serif; font-size: 14px; color: var(--ink);
          outline: none; transition: border-color .2s;
        }
        .pf-search:focus { border-color: var(--accent); }
        .pf-search::placeholder { color: #aaa195; }
        .pf-tagbar {
          display: flex; gap: 7px; overflow-x: auto; padding: 12px 0 2px;
          -ms-overflow-style: none; scrollbar-width: none;
        }
        .pf-tagbar::-webkit-scrollbar { display: none; }
        .pf-tag {
          flex: 0 0 auto; padding: 5px 12px; border-radius: 999px;
          border: 1px solid var(--line); background: transparent;
          font-size: 12px; color: var(--ink-soft); cursor: pointer;
          white-space: nowrap; transition: all .15s; font-family: 'Archivo', sans-serif;
        }
        .pf-tag.on { background: var(--ink); color: var(--paper); border-color: var(--ink); }

        .pf-feed { padding: 6px 14px 40px; display: flex; flex-direction: column; gap: 14px; }

        .pf-card {
          background: var(--paper-2);
          border: 1px solid var(--line);
          border-radius: 18px;
          padding: 18px 18px 12px;
          box-shadow: 0 1px 0 rgba(0,0,0,0.02), 0 12px 28px -22px rgba(60,40,20,0.5);
          animation: rise .5s ease both;
        }
        @keyframes rise { from { opacity:0; transform: translateY(10px);} to {opacity:1; transform:none;} }

        .pf-meta { display:flex; align-items:center; gap:8px; margin-bottom:9px; font-size:11.5px; color: var(--ink-soft); }
        .pf-venue { font-weight:600; color: var(--accent); }
        .pf-dot { width:3px; height:3px; border-radius:50%; background:#c9bfae; }
        .pf-unread { margin-left:auto; width:8px; height:8px; border-radius:50%; background: var(--accent); }

        .pf-title {
          font-family: 'Fraunces', serif; font-weight: 600; font-size: 19px;
          line-height: 1.25; letter-spacing: -0.01em; margin: 0 0 5px;
        }
        .pf-authors { font-size: 12.5px; color: var(--ink-soft); margin-bottom: 11px; }

        .pf-summary {
          font-family: 'Newsreader', serif; font-size: 15.5px; line-height: 1.55;
          color: #2a2620;
        }
        .pf-summary.clamp {
          display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
        }
        .pf-more {
          background:none; border:none; color: var(--accent); font-size:12.5px;
          padding:4px 0 0; cursor:pointer; font-family:'Archivo',sans-serif; font-weight:600;
        }
        .pf-chips { display:flex; flex-wrap:wrap; gap:6px; margin:12px 0 4px; }
        .pf-chip {
          font-size:11px; padding:3px 9px; border-radius:6px;
          background: var(--accent-soft); color: #8a3320; font-weight:500;
        }

        .pf-actions {
          display:flex; align-items:center; gap:4px; margin-top:8px;
          padding-top:10px; border-top:1px dashed var(--line);
        }
        .pf-act {
          display:flex; align-items:center; gap:5px; background:none; border:none;
          padding:7px 9px; border-radius:9px; cursor:pointer; color: var(--ink-soft);
          font-family:'Archivo',sans-serif; font-size:12.5px; transition: background .15s, color .15s;
        }
        .pf-act:hover { background: #f0e9da; }
        .pf-act.liked { color: var(--accent); }
        .pf-act.done { color: #2f7d4f; }
        .pf-act svg { width:17px; height:17px; }
        .pf-spacer { flex:1; }

        .pf-empty { text-align:center; color:var(--ink-soft); padding:60px 20px; font-family:'Newsreader',serif; font-size:16px; }
      `}</style>

      <div className="pf-phone">
        <div className="pf-header">
          <div className="pf-brand">
            <span className="pf-logo">Stacks<span className="dot">.</span></span>
            <span className="pf-tagline">隙間時間で、ぐんぐん読む</span>
          </div>
          <input
            className="pf-search"
            placeholder="検索（例: 物理 シミュレーション）"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="pf-tagbar">
            {ALL_TAGS.map((t) => (
              <button
                key={t}
                className={"pf-tag" + (activeTags.includes(t) ? " on" : "")}
                onClick={() => toggleTag(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="pf-feed">
          {filtered.length === 0 && (
            <div className="pf-empty">該当する論文がありません。<br />タグや検索を見直してみて。</div>
          )}
          {filtered.map((p) => {
            const isOpen = expanded[p.id];
            return (
              <article className="pf-card" key={p.id}>
                <div className="pf-meta">
                  <span className="pf-venue">{p.venue}</span>
                  <span className="pf-dot" />
                  <span>{p.year}</span>
                  {!p.read && <span className="pf-unread" title="未読" />}
                </div>
                <h2 className="pf-title">{p.title}</h2>
                <div className="pf-authors">{p.authors}</div>
                <p className={"pf-summary" + (isOpen ? "" : " clamp")}>{p.summary}</p>
                <button className="pf-more" onClick={() => toggleExpand(p.id)}>
                  {isOpen ? "閉じる" : "続きを読む"}
                </button>

                <div className="pf-chips">
                  {p.tags.map((t) => (
                    <span className="pf-chip" key={t}>#{t}</span>
                  ))}
                </div>

                <div className="pf-actions">
                  <button
                    className={"pf-act" + (p.liked ? " liked" : "")}
                    onClick={() => toggleLike(p.id)}
                  >
                    <svg viewBox="0 0 24 24" fill={p.liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
                      <path d="M12 21s-7.5-4.6-10-9C.6 9.4 1.6 6 5 5c2.1-.6 3.9.5 5 2 1.1-1.5 2.9-2.6 5-2 3.4 1 4.4 4.4 3 7-2.5 4.4-10 9-10 9z" />
                    </svg>
                    いいね
                  </button>
                  <button className="pf-act">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M4 5h16v11H7l-3 3V5z" strokeLinejoin="round" />
                    </svg>
                    メモ
                  </button>
                  <span className="pf-spacer" />
                  <button
                    className={"pf-act" + (p.read ? " done" : "")}
                    onClick={() => toggleRead(p.id)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M4 12.5l5 5 11-11" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {p.read ? "既読" : "未読"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
