import { BLUEPRINT_STAGES, WORKSTREAM_TRACKS } from "@brand95/domain";

export default function BlueprintReferencePage() {
  return (
    <>
      <div className="page-header">
        <div>
          <h1>The Brand95 Blueprint</h1>
          <div className="sub">
            Eleven stages from idea to a self-running brand. Every brand created
            in Brand95 OS is instantiated from this blueprint; gates unlock on
            evidence plus an explicit founder decision.
          </div>
        </div>
      </div>

      {BLUEPRINT_STAGES.map((stage) => (
        <div key={stage.slug} className="stage-row">
          <div className="stage-num">{stage.index}</div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: "2px 0 4px" }}>{stage.name}</h3>
            <div className="muted">{stage.purpose}</div>
            <details style={{ marginTop: 8 }}>
              <summary className="muted" style={{ cursor: "pointer" }}>
                {stage.requiredOutputs.length} required outputs ·{" "}
                {stage.gateCriteria.length} gate criteria
              </summary>
              <div className="grid cols-2" style={{ marginTop: 10 }}>
                <div className="card">
                  <h3 style={{ fontSize: 14 }}>Required outputs</h3>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5 }}>
                    {stage.requiredOutputs.map((o) => (
                      <li key={o}>{o}</li>
                    ))}
                  </ul>
                </div>
                <div className="card">
                  <h3 style={{ fontSize: 14 }}>Exit gate</h3>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5 }}>
                    {stage.gateCriteria.map((c) => (
                      <li key={c.key}>
                        {c.label}
                        {c.founderJudgment && (
                          <span className="badge red" style={{ marginLeft: 6 }}>
                            founder
                          </span>
                        )}
                        {c.evidenceTarget && (
                          <div className="muted">Target: {c.evidenceTarget}</div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </details>
          </div>
        </div>
      ))}

      <h2>The two tracks</h2>
      <div className="grid cols-2">
        {Object.entries(WORKSTREAM_TRACKS).map(([track, names]) => (
          <div key={track} className="card">
            <h3>{track === "BRAND" ? "Brand Track" : "Commercial Track"}</h3>
            <div className="muted">{names.join(" · ")}</div>
          </div>
        ))}
      </div>
    </>
  );
}
