import fs from "fs";
import path from "path";
import { runRuntimeAgent } from "./runtime-adapter";
import { save_artifact } from "./tool-executor";
import { queryRelevantInsights, publishInsight } from "./insights-engine";

interface WorkflowStep {
  agent: string;
  mode: string;
  task: string;
}

interface WorkflowTemplate {
  name: string;
  description: string;
  required_inputs: string[];
  optional_inputs: string[];
  execution_steps: WorkflowStep[];
  output_artifacts: string[];
}

interface WorkflowDefinitionFile {
  workflows: WorkflowTemplate[];
}

const workspaceRoot = path.resolve(__dirname, "..");

function log(message: string, runId?: string) {
  console.log(`[WORKFLOW${runId ? `:${runId}` : ""}] ${message}`);
}

function nowId(): string {
  return `run-${new Date().toISOString().slice(0, 10)}-${String(Date.now()).slice(-3)}`;
}

function loadTemplates(): WorkflowTemplate[] {
  const filePath = path.join(workspaceRoot, "orchestration", "workflow-templates.json");
  const raw = fs.readFileSync(filePath, "utf8");
  const data = JSON.parse(raw) as WorkflowDefinitionFile;
  return data.workflows || [];
}

function validateWorkflow(template: WorkflowTemplate): void {
  if (!template.name || !template.description) throw new Error("Invalid workflow template metadata");
  if (!Array.isArray(template.required_inputs)) throw new Error("required_inputs must be an array");
  if (!Array.isArray(template.optional_inputs)) throw new Error("optional_inputs must be an array");
  if (!Array.isArray(template.execution_steps) || template.execution_steps.length === 0) throw new Error("execution_steps must be a non-empty array");
  if (!Array.isArray(template.output_artifacts) || template.output_artifacts.length === 0) throw new Error("output_artifacts must be a non-empty array");

  for (const step of template.execution_steps) {
    if (!step.agent || !step.mode || !step.task) throw new Error(`Invalid step in ${template.name}`);
  }
}

export function listWorkflowTemplates(): WorkflowTemplate[] {
  const templates = loadTemplates();
  templates.forEach(validateWorkflow);
  return templates;
}

export async function runWorkflow(name: string, inputPayload: Record<string, unknown>): Promise<{ runId: string; workflow: WorkflowTemplate }> {
  const templates = listWorkflowTemplates();
  const workflow = templates.find((item) => item.name === name);
  if (!workflow) throw new Error(`Unknown workflow template: ${name}`);

  for (const required of workflow.required_inputs) {
    if (!(required in inputPayload)) {
      throw new Error(`Missing required input: ${required}`);
    }
  }

  const runId = nowId();
  const runRoot = path.join("outputs", workflow.name, runId);

  log(`workflow_loaded=${workflow.name}`, runId);
  log(`validation=success`, runId);
  log(`input_payload=${JSON.stringify(inputPayload)}`, runId);
  log(`run_root=${runRoot}`, runId);

  for (const [index, step] of workflow.execution_steps.entries()) {
    const stepId = index + 1;
    log(`step_execution=${stepId} agent=${step.agent} mode=${step.mode}`, runId);
    const relevantInsights = queryRelevantInsights([workflow.name, step.agent.toLowerCase()], Object.keys(inputPayload).map(String));
    const stepInput = JSON.stringify({ inputPayload, runId, workflow: workflow.name, step: stepId, insights: relevantInsights });
    const output = await runRuntimeAgent({
      agent: step.agent,
      mode: step.mode,
      task: `${step.task}\n\nINPUT:\n${stepInput}`,
      return_to: "Ash"
    });
    publishInsight({
      source_workflow: workflow.name,
      department: step.agent,
      timestamp: new Date().toISOString(),
      confidence: relevantInsights.length > 0 ? "high" : "medium",
      summary: output.slice(0, 250),
      tags: Object.keys(inputPayload).map(String),
      related_domains: [workflow.name]
    });
    const artifactName = workflow.output_artifacts[index] || workflow.output_artifacts[workflow.output_artifacts.length - 1];
    if (artifactName) {
      const relativeArtifact = path.join(workflow.name, runId, path.basename(artifactName));
      const result = save_artifact(step.agent, relativeArtifact, output);
      log(`artifact_generation=${result.success ? "success" : "failure"} path=${result.verified_path}`, runId);
    }
  }

  log(`finalisation_completion=${workflow.name}`, runId);
  log(`workflow_resolution=complete`, runId);

  return { runId, workflow };
}
