import { runWorkflow } from "./workflow-engine";

export async function handleApproval(status: "approved" | "denied" | "modified", workflowName: string, inputPayload: Record<string, unknown>) {
  if (status === "denied") {
    console.log(`[APPROVAL] denied workflow=${workflowName}`);
    return { executed: false };
  }

  if (status === "modified") {
    console.log(`[APPROVAL] modified workflow=${workflowName}`);
  } else {
    console.log(`[APPROVAL] approved workflow=${workflowName}`);
  }

  const result = await runWorkflow(workflowName, inputPayload);
  return { executed: true, result };
}
