import { Market } from "../../components/Market";
import { LiveEvidence } from "../../components/LiveEvidence";
export default function Page() {
  return (
    <main>
      <Market mode="verify" />
      <LiveEvidence />
    </main>
  );
}
