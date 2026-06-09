import { useContext, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { UserContext } from "../context";
import { authorOptions } from "./UpdateModal";

interface Props {
  workspace: string;
  today: string;
  onClose: () => void;
  onCreated: (dealId: string) => void;
}

const REGIONS = ["NL-North", "NL-East", "NL-West", "NL-South", "NL", "BE", "DE", "EU", "Other"];
const CAPABILITIES = [
  "Separation + WtE",
  "WtE only",
  "Recycling-led",
  "Separation + digestion",
  "Chemical / process",
  "Other",
];

// A new record card is born: the account facts every deal starts with.
// It enters at Lead — the staircase does the rest.
export function NewDealModal({ workspace, today, onClose, onCreated }: Props) {
  const createDeal = useMutation(api.deals.createDeal);
  const user = useContext(UserContext);
  const [account, setAccount] = useState("");
  const [site, setSite] = useState("");
  const [region, setRegion] = useState("NL");
  const [throughput, setThroughput] = useState("");
  const [capability, setCapability] = useState(CAPABILITIES[0]);
  const [hook, setHook] = useState("");
  const [acv, setAcv] = useState("");
  const [pocFee, setPocFee] = useState("25000");
  const [owner, setOwner] = useState(user.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = account.trim() && site.trim() && hook.trim() && Number(acv) > 0;

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      const { dealId } = await createDeal({
        workspace,
        account: account.trim(),
        site: site.trim(),
        region,
        throughput: throughput.trim() || "—",
        capability,
        hook: hook.trim(),
        acv: Number(acv),
        pocFee: Number(pocFee) > 0 ? Number(pocFee) : undefined,
        owner,
        at: today,
        author: owner,
      });
      onCreated(dealId as unknown as string);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="scrim modal-scrim" onClick={onClose} />
      <div className="modal" style={{ width: "min(560px, 94vw)" }}>
        <h3>New deal{workspace === "sim" ? " · simulation" : ""}</h3>
        <p className="modal-sub">
          The account facts the record card starts with. The deal enters at <b>Lead</b> — file the pre-meeting prep to earn Discovery.
        </p>
        <div className="tpl-form">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label className="f-field">
              <span>Account *</span>
              <input value={account} placeholder="e.g. Indaver" onChange={(e) => setAccount(e.target.value)} />
            </label>
            <label className="f-field">
              <span>Site *</span>
              <input value={site} placeholder="e.g. Antwerpen (BE)" onChange={(e) => setSite(e.target.value)} />
            </label>
            <label className="f-field">
              <span>Region</span>
              <select value={region} onChange={(e) => setRegion(e.target.value)}>
                {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label className="f-field">
              <span>Capability</span>
              <select value={capability} onChange={(e) => setCapability(e.target.value)}>
                {CAPABILITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="f-field">
              <span>Throughput (indicative)</span>
              <input value={throughput} placeholder="e.g. ~1,200 t/day" onChange={(e) => setThroughput(e.target.value)} />
            </label>
            <label className="f-field">
              <span>Owner</span>
              <select value={owner} onChange={(e) => setOwner(e.target.value)}>
                {authorOptions(user.name).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="f-field">
              <span>ACV target (EUR) *</span>
              <input type="number" value={acv} placeholder="75000" onChange={(e) => setAcv(e.target.value)} />
            </label>
            <label className="f-field">
              <span>POC fee (EUR)</span>
              <input type="number" value={pocFee} onChange={(e) => setPocFee(e.target.value)} />
            </label>
          </div>
          <label className="f-field">
            <span>The hook — why this account, in one or two lines *</span>
            <textarea
              rows={2}
              value={hook}
              placeholder="The € story: what variable input + operator judgment + expensive asset looks like here."
              onChange={(e) => setHook(e.target.value)}
            />
          </label>
        </div>
        {error && <p style={{ color: "var(--red)", fontSize: 12 }}>{error}</p>}
        <footer className="modal-foot">
          <button className="btn quiet" onClick={onClose} disabled={busy}>Cancel</button>
          <span className="spacer" />
          <button className="btn primary" onClick={submit} disabled={busy || !valid}>
            {busy ? "Creating…" : "Create deal"}
          </button>
        </footer>
      </div>
    </>
  );
}
