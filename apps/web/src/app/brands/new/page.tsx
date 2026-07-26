import { CreateBrandWizard } from "./wizard";

export default function NewBrandPage() {
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Create new brand</h1>
          <div className="sub">
            Three steps: the idea, the constraints, then Brand95 OS sets up the
            full Blueprint — stages, gates, workstreams, first tasks, and the
            initial risk register.
          </div>
        </div>
      </div>
      <CreateBrandWizard />
    </>
  );
}
