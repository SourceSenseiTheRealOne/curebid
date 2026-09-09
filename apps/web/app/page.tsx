import Mechanism from "../components/Mechanism";
import { Market } from "../components/Market";
export default function Page() {
  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Outcome-priced debt repayment</span>
          <h1>
            Your debt.
            <br />
            Their liquidity.
          </h1>
          <p>
            Keep your collateral. Providers compete to repay your Aave debt.
            Verified results unlock payment.
          </p>
          <div className="actions">
            <a className="primary button" href="/repay">
              Start repaying ↗
            </a>
            <a className="text-link" href="/providers">
              Become a provider →
            </a>
          </div>
        </div>
        <Mechanism />
      </section>
      <section className="flow">
        <div>
          <span>Choose your terms</span>
          <p>
            One USDC target. Competing CTC quotes. You choose who gets the job.
          </p>
        </div>
        <div>
          <span>Repay the actual debt</span>
          <p>
            The provider repays Aave on Sepolia. Your collateral stays in place.
          </p>
        </div>
        <div>
          <span>Pay for proof</span>
          <p>
            Attestcoin authenticates the outcome before Creditcoin releases
            reimbursement.
          </p>
        </div>
      </section>
      <Market mode="home" />
      <section className="safety">
        <h2>Two chains. One verifiable outcome.</h2>
        <p>
          A transfer is not a repayment. CureBid checks the router outcome and
          Aave repayment event in the same authenticated receipt. No
          administrator can substitute a success flag.
        </p>
        <a href="/verify">Inspect the proof boundary ↗</a>
      </section>
    </main>
  );
}
