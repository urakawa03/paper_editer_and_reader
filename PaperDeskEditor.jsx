import React, { useState, useMemo } from "react";

// スマホ版フィード(PaperFeed.jsx)と同じ論文に Summary/Notes を持たせたデータ
const INITIAL = [
  {
    id: "vaswani2017attention",
    title: "Attention Is All You Need",
    authors: "Vaswani, Shazeer, Parmar 他",
    year: 2017,
    venue: "NeurIPS",
    url: "https://arxiv.org/abs/1706.03762",
    tags: ["機械学習", "Transformer", "NLP"],
    liked: true,
    status: "read",
    summary:
      "再帰も畳み込みも使わず、アテンション機構だけで系列変換を行うTransformerを提案。並列計算が効くため学習が高速で、翻訳タスクで当時の最高精度を更新した。現在の大規模言語モデルの土台になった一本。",
    notes: "self-attentionの計算量 O(n^2) が長系列でネックになる点、後続研究と合わせて要確認。",
  },
  {
    id: "abbott2016gw",
    title: "Observation of Gravitational Waves from a Binary Black Hole Merger",
    authors: "Abbott 他 (LIGO)",
    year: 2016,
    venue: "Phys. Rev. Lett.",
    url: "https://doi.org/10.1103/PhysRevLett.116.061102",
    tags: ["物理", "重力波", "観測"],
    liked: false,
    status: "reading",
    summary:
      "二つのブラックホール合体が放つ重力波を史上初めて直接検出。アインシュタインの一般相対論から100年越しの予言を実証した。信号の波形から両天体の質量と距離を推定している。",
    notes: "",
  },
  {
    id: "metropolis1953",
    title: "Equation of State Calculations by Fast Computing Machines",
    authors: "Metropolis, Rosenbluth 他",
    year: 1953,
    venue: "J. Chem. Phys.",
    url: "https://doi.org/10.1063/1.1699114",
    tags: ["物理", "シミュレーション", "モンテカルロ"],
    liked: true,
    status: "unread",
    summary:
      "後に「メトロポリス法」と呼ばれるマルコフ連鎖モンテカルロの原型を示した古典。確率分布に従うサンプリングを乱数で実現し、計算物理・統計力学のシミュレーション手法の出発点になった。",
    notes: "受理確率 min(1, ...) の導出を自分で追っておく。",
  },
  {
    id: "he2015resnet",
    title: "Deep Residual Learning for Image Recognition",
    authors: "He, Zhang, Ren, Sun",
    year: 2015,
    venue: "CVPR",
    url: "https://arxiv.org/abs/1512.03385",
    tags: ["機械学習", "画像認識", "深層学習"],
    liked: false,
    status: "read",
    summary:
      "層を深くすると精度が落ちる劣化問題を、残差接続(skip connection)で解決。152層という当時破格の深さを安定して学習でき、画像認識の精度を一気に押し上げた。",
    notes: "",
  },
  {
    id: "shaw2010md",
    title: "Molecular Dynamics Simulation of Protein Folding",
    authors: "Shaw 他",
    year: 2010,
    venue: "Science",
    url: "https://doi.org/10.1126/science.1187409",
    tags: ["シミュレーション", "生物物理", "分子動力学"],
    liked: false,
    status: "unread",
    summary:
      "専用計算機を用い、ミリ秒スケールの分子動力学シミュレーションでタンパク質の折りたたみ過程を直接観察。実験では捉えにくい中間状態の構造変化を時間分解で可視化した。",
    notes: "",
  },
];

const STATUS_LABEL = { unread: "未読", reading: "読書中", read: "既読" };
const STATUS_ORDER = ["unread", "reading", "read"];

export default function PaperDeskEditor() {
  const [papers, setPapers] = useState(INITIAL);
  const [selectedId, setSelectedId] = useState(INITIAL[0].id);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("AND"); // AND | OR
  const [sort, setSort] = useState("year"); // year | title
  const [tagFilter, setTagFilter] = useState([]);
  const [saved, setSaved] = useState(true);

  const allTags = useMemo(
    () => [...new Set(papers.flatMap((p) => p.tags))],
    [papers]
  );

  const update = (id, patch) => {
    setPapers((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    setSaved(false);
    // 実アプリでは debounce して GitHub へ書き戻す（楽観的更新）
    setTimeout(() => setSaved(true), 700);
  };

  const toggleTagFilter = (t) =>
    setTagFilter((a) => (a.includes(t) ? a.filter((x) => x !== t) : [...a, t]));

  const filtered = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let list = papers.filter((p) => {
      const hay = (
        p.title +
        " " +
        p.authors +
        " " +
        p.tags.join(" ") +
        " " +
        p.summary
      ).toLowerCase();
      const matchQuery =
        terms.length === 0 ||
        (mode === "AND"
          ? terms.every((t) => hay.includes(t))
          : terms.some((t) => hay.includes(t)));
      const matchTags = tagFilter.every((t) => p.tags.includes(t));
      return matchQuery && matchTags;
    });
    list = [...list].sort((a, b) =>
      sort === "year" ? b.year - a.year : a.title.localeCompare(b.title)
    );
    return list;
  }, [papers, query, mode, tagFilter, sort]);

  const sel = papers.find((p) => p.id === selectedId);

  return (
    <div className="desk-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,800&family=Newsreader:opsz,wght@6..72,400;6..72,500&family=Archivo:wght@400;500;600&display=swap');
        .desk-root {
          --paper:#f6f1e7; --paper-2:#fffdf8; --ink:#1d1a17; --ink-soft:#5a534a;
          --line:#e3dac8; --accent:#c0432a; --accent-soft:#f3e0d9; --ok:#2f7d4f;
          font-family:'Archivo',sans-serif; color:var(--ink);
          background:var(--paper); min-height:100vh; display:flex; flex-direction:column;
        }
        .desk-top {
          display:flex; align-items:center; gap:16px; padding:14px 20px;
          border-bottom:1px solid var(--line); background:var(--paper-2); position:sticky; top:0; z-index:5;
        }
        .desk-logo { font-family:'Fraunces',serif; font-weight:800; font-size:22px; letter-spacing:-0.02em; }
        .desk-logo .dot { color:var(--accent); }
        .desk-search {
          flex:1; max-width:420px; padding:9px 13px; border-radius:11px; border:1px solid var(--line);
          background:var(--paper); font-family:'Archivo',sans-serif; font-size:14px; outline:none;
        }
        .desk-search:focus { border-color:var(--accent); }
        .seg { display:flex; border:1px solid var(--line); border-radius:9px; overflow:hidden; }
        .seg button {
          border:none; background:var(--paper); padding:8px 12px; font-size:12.5px; cursor:pointer;
          color:var(--ink-soft); font-family:'Archivo',sans-serif;
        }
        .seg button.on { background:var(--ink); color:var(--paper); }
        .desk-save { margin-left:auto; font-size:12px; color:var(--ink-soft); display:flex; align-items:center; gap:6px; }
        .desk-save .pulse { width:8px; height:8px; border-radius:50%; background:var(--ok); }
        .desk-save.dirty .pulse { background:var(--accent); }

        .desk-body { display:flex; flex:1; min-height:0; }

        .desk-list { width:420px; border-right:1px solid var(--line); overflow-y:auto; background:var(--paper); }
        .desk-tagbar { display:flex; flex-wrap:wrap; gap:6px; padding:12px 14px; border-bottom:1px solid var(--line); }
        .desk-tag {
          font-size:11.5px; padding:4px 10px; border-radius:999px; border:1px solid var(--line);
          background:transparent; color:var(--ink-soft); cursor:pointer; font-family:'Archivo',sans-serif;
        }
        .desk-tag.on { background:var(--ink); color:var(--paper); border-color:var(--ink); }
        .desk-sort { margin-left:auto; font-size:11.5px; color:var(--ink-soft); display:flex; gap:8px; align-items:center; }
        .desk-sort select { font-family:'Archivo',sans-serif; font-size:11.5px; border:1px solid var(--line); border-radius:7px; padding:3px 6px; background:var(--paper); }

        .row {
          padding:13px 15px; border-bottom:1px solid var(--line); cursor:pointer; transition:background .12s;
        }
        .row:hover { background:#f0e9da; }
        .row.sel { background:var(--accent-soft); box-shadow:inset 3px 0 0 var(--accent); }
        .row-title { font-family:'Fraunces',serif; font-weight:600; font-size:14.5px; line-height:1.3; margin-bottom:4px; }
        .row-meta { font-size:11.5px; color:var(--ink-soft); display:flex; align-items:center; gap:7px; flex-wrap:wrap; }
        .row-dot { width:7px; height:7px; border-radius:50%; }
        .dot-unread{background:var(--accent);} .dot-reading{background:#c89a2b;} .dot-read{background:var(--ok);}
        .row-heart { color:var(--accent); font-size:12px; }
        .row-summary {
          font-family:'Newsreader',serif; font-size:13.5px; line-height:1.5; color:#4a443c;
          margin-top:7px; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;
        }
        .row-notes {
          display:flex; gap:6px; margin-top:7px; font-size:12.5px; line-height:1.45; color:var(--ink-soft);
        }
        .row-notes .pen { color:var(--accent); flex:0 0 auto; font-size:11px; margin-top:1px; }
        .row-notes .ntext { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }

        .desk-editor { flex:1; overflow-y:auto; padding:34px 44px; max-width:780px; }
        .ed-eyebrow { font-size:11.5px; letter-spacing:0.06em; text-transform:uppercase; color:var(--accent); font-weight:600; margin-bottom:10px; }
        .ed-title {
          font-family:'Fraunces',serif; font-weight:600; font-size:27px; line-height:1.2; letter-spacing:-0.01em;
          border:none; background:transparent; width:100%; resize:none; color:var(--ink); outline:none; margin-bottom:8px;
        }
        .ed-sub { display:flex; gap:8px; align-items:center; font-size:13px; color:var(--ink-soft); flex-wrap:wrap; margin-bottom:18px; }
        .ed-sub input { border:none; background:transparent; font-family:'Archivo',sans-serif; font-size:13px; color:var(--ink-soft); outline:none; }
        .ed-sub .yr { width:48px; } .ed-sub .vn { width:120px; }
        .ed-chips { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:24px; align-items:center; }
        .ed-chip { font-size:11.5px; padding:4px 10px; border-radius:6px; background:var(--accent-soft); color:#8a3320; font-weight:500; display:flex; gap:6px; align-items:center; }
        .ed-chip button { border:none; background:none; color:#8a3320; cursor:pointer; font-size:13px; line-height:1; opacity:.6; }
        .ed-addtag { font-size:11.5px; border:1px dashed var(--line); border-radius:6px; padding:4px 9px; background:transparent; color:var(--ink-soft); cursor:pointer; }

        .ed-section-label { font-family:'Archivo',sans-serif; font-size:12px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:var(--ink-soft); margin:0 0 8px; }
        .ed-area {
          width:100%; border:1px solid var(--line); border-radius:12px; padding:15px 17px; background:var(--paper-2);
          font-family:'Newsreader',serif; font-size:16px; line-height:1.6; color:#2a2620; resize:vertical; outline:none; box-sizing:border-box;
        }
        .ed-area:focus { border-color:var(--accent); }
        .ed-area.notes { min-height:90px; font-style:normal; }
        .ed-block { margin-bottom:24px; }

        .ed-footer { display:flex; align-items:center; gap:10px; border-top:1px dashed var(--line); padding-top:18px; margin-top:8px; }
        .ed-btn {
          display:flex; align-items:center; gap:7px; border:1px solid var(--line); background:var(--paper-2);
          border-radius:10px; padding:8px 13px; font-size:13px; cursor:pointer; color:var(--ink-soft); font-family:'Archivo',sans-serif;
        }
        .ed-btn:hover { background:#f0e9da; }
        .ed-btn.on-like { color:var(--accent); border-color:var(--accent); }
        .ed-btn.on-read { color:var(--ok); border-color:var(--ok); }
        .ed-link { margin-left:auto; font-size:13px; color:var(--accent); text-decoration:none; }
        .ed-empty { padding:60px; color:var(--ink-soft); font-family:'Newsreader',serif; font-size:17px; }
      `}</style>

      {/* トップバー：検索 + AND/OR + 同期状態 */}
      <div className="desk-top">
        <span className="desk-logo">Stacks<span className="dot">.</span></span>
        <input
          className="desk-search"
          placeholder="検索（スペース区切りで複数語）"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="seg">
          {["AND", "OR"].map((m) => (
            <button key={m} className={mode === m ? "on" : ""} onClick={() => setMode(m)}>
              {m}
            </button>
          ))}
        </div>
        <div className={"desk-save" + (saved ? "" : " dirty")}>
          <span className="pulse" />
          {saved ? "GitHubと同期済み" : "保存中…"}
        </div>
      </div>

      <div className="desk-body">
        {/* 左：論文リスト（俯瞰） */}
        <div className="desk-list">
          <div className="desk-tagbar">
            {allTags.map((t) => (
              <button
                key={t}
                className={"desk-tag" + (tagFilter.includes(t) ? " on" : "")}
                onClick={() => toggleTagFilter(t)}
              >
                {t}
              </button>
            ))}
            <span className="desk-sort">
              並び
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="year">年(新しい順)</option>
                <option value="title">タイトル</option>
              </select>
            </span>
          </div>
          {filtered.map((p) => (
            <div
              key={p.id}
              className={"row" + (p.id === selectedId ? " sel" : "")}
              onClick={() => setSelectedId(p.id)}
            >
              <div className="row-title">{p.title}</div>
              <div className="row-meta">
                <span className={"row-dot dot-" + p.status} title={STATUS_LABEL[p.status]} />
                <span>{p.year}</span>
                <span>·</span>
                <span>{p.authors}</span>
                {p.liked && <span className="row-heart">♥</span>}
              </div>
              {p.summary && <div className="row-summary">{p.summary}</div>}
              {p.notes && (
                <div className="row-notes">
                  <span className="pen">✎</span>
                  <span className="ntext">{p.notes}</span>
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: 24, color: "var(--ink-soft)", fontSize: 14 }}>
              該当なし。検索やタグを見直してください。
            </div>
          )}
        </div>

        {/* 右：本文の編集ペイン（Basesができなかった部分） */}
        {sel ? (
          <div className="desk-editor" key={sel.id}>
            <div className="ed-eyebrow">{sel.venue} · {sel.id}</div>
            <textarea
              className="ed-title"
              rows={2}
              value={sel.title}
              onChange={(e) => update(sel.id, { title: e.target.value })}
            />
            <div className="ed-sub">
              <input
                value={sel.authors}
                onChange={(e) => update(sel.id, { authors: e.target.value })}
                style={{ minWidth: 220 }}
              />
              <span>·</span>
              <input
                className="yr"
                value={sel.year}
                onChange={(e) => update(sel.id, { year: e.target.value })}
              />
              <span>·</span>
              <input
                className="vn"
                value={sel.venue}
                onChange={(e) => update(sel.id, { venue: e.target.value })}
              />
            </div>

            <div className="ed-chips">
              {sel.tags.map((t) => (
                <span className="ed-chip" key={t}>
                  #{t}
                  <button
                    onClick={() =>
                      update(sel.id, { tags: sel.tags.filter((x) => x !== t) })
                    }
                  >
                    ×
                  </button>
                </span>
              ))}
              <button
                className="ed-addtag"
                onClick={() => {
                  const t = window.prompt("追加するタグ");
                  if (t && !sel.tags.includes(t))
                    update(sel.id, { tags: [...sel.tags, t] });
                }}
              >
                + タグ
              </button>
            </div>

            <div className="ed-block">
              <p className="ed-section-label">Abstract（原文・編集可）</p>
              <textarea
                className="ed-area"
                rows={5}
                value={sel.summary}
                onChange={(e) => update(sel.id, { summary: e.target.value })}
              />
            </div>

            <div className="ed-block">
              <p className="ed-section-label">Notes（自分のメモ）</p>
              <textarea
                className="ed-area notes"
                rows={4}
                placeholder="読みながら気づいたことを書く…"
                value={sel.notes}
                onChange={(e) => update(sel.id, { notes: e.target.value })}
              />
            </div>

            <div className="ed-footer">
              <button
                className={"ed-btn" + (sel.liked ? " on-like" : "")}
                onClick={() => update(sel.id, { liked: !sel.liked })}
              >
                {sel.liked ? "♥ いいね済み" : "♡ いいね"}
              </button>
              <button
                className={"ed-btn" + (sel.status === "read" ? " on-read" : "")}
                onClick={() => {
                  const next =
                    STATUS_ORDER[(STATUS_ORDER.indexOf(sel.status) + 1) % 3];
                  update(sel.id, { status: next });
                }}
              >
                状態: {STATUS_LABEL[sel.status]}
              </button>
              <a className="ed-link" href={sel.url} target="_blank" rel="noreferrer">
                元論文を開く ↗
              </a>
            </div>
          </div>
        ) : (
          <div className="ed-empty">左のリストから論文を選んでください。</div>
        )}
      </div>
    </div>
  );
}
