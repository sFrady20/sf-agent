// GitHub Projects v2 (GraphQL — Projects has no REST API). The agent fully
// controls one board (GITHUB_PROJECT_ID) — a copy of Steven's real board, so the
// original is never touched. Auth: GITHUB_TOKEN (fine-grained PAT with Projects
// read/write, or classic `project` scope). Zero deps — plain fetch.

const GH_GRAPHQL = "https://api.github.com/graphql";

export interface WorkItem {
  id: string;
  title: string;
  status?: string;
  url?: string;
}

export function githubConfigured(): boolean {
  return Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_PROJECT_ID);
}

function token(): string {
  const t = process.env.GITHUB_TOKEN;
  if (!t) throw new Error("GitHub not configured (GITHUB_TOKEN).");
  return t;
}

function projectId(): string {
  const id = process.env.GITHUB_PROJECT_ID;
  if (!id) throw new Error("GitHub board not connected (GITHUB_PROJECT_ID).");
  return id;
}

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(GH_GRAPHQL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) {
    throw new Error(`GitHub GraphQL: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  return json.data as T;
}

interface ItemsResponse {
  node: {
    items: {
      nodes: Array<{
        id: string;
        content: { title?: string; url?: string } | null;
        fieldValues: { nodes: Array<{ name?: string; field?: { name?: string } }> };
      }>;
    };
  };
}

export async function listItems(limit = 30): Promise<WorkItem[]> {
  const data = await gql<ItemsResponse>(
    `query($id: ID!, $n: Int!) {
      node(id: $id) { ... on ProjectV2 {
        items(first: $n) { nodes {
          id
          content {
            ... on DraftIssue { title }
            ... on Issue { title url }
            ... on PullRequest { title url }
          }
          fieldValues(first: 20) { nodes {
            ... on ProjectV2ItemFieldSingleSelectValue {
              name
              field { ... on ProjectV2FieldCommon { name } }
            }
          } }
        } }
      } }
    }`,
    { id: projectId(), n: limit },
  );
  return data.node.items.nodes.map((it) => ({
    id: it.id,
    title: it.content?.title ?? "(untitled)",
    url: it.content?.url,
    status: it.fieldValues.nodes.find((v) => v.field?.name === "Status")?.name,
  }));
}

export async function addDraftItem(title: string, body?: string): Promise<{ id: string }> {
  const data = await gql<{ addProjectV2DraftIssue: { projectItem: { id: string } } }>(
    `mutation($id: ID!, $title: String!, $body: String) {
      addProjectV2DraftIssue(input: { projectId: $id, title: $title, body: $body }) {
        projectItem { id }
      }
    }`,
    { id: projectId(), title, body },
  );
  return { id: data.addProjectV2DraftIssue.projectItem.id };
}

interface StatusField {
  fieldId: string;
  options: Array<{ id: string; name: string }>;
}
let statusFieldCache: StatusField | null = null;

async function getStatusField(): Promise<StatusField | null> {
  if (statusFieldCache) return statusFieldCache;
  const data = await gql<{
    node: { fields: { nodes: Array<{ id?: string; name?: string; options?: Array<{ id: string; name: string }> }> } };
  }>(
    `query($id: ID!) {
      node(id: $id) { ... on ProjectV2 {
        fields(first: 50) {
          nodes { ... on ProjectV2SingleSelectField { id name options { id name } } }
        }
      } }
    }`,
    { id: projectId() },
  );
  const field = data.node.fields.nodes.find((f) => f.name === "Status" && f.options);
  if (!field?.id || !field.options) return null;
  statusFieldCache = { fieldId: field.id, options: field.options };
  return statusFieldCache;
}

export async function setItemStatus(
  itemId: string,
  statusName: string,
): Promise<{ ok: boolean; status?: string; error?: string }> {
  const field = await getStatusField();
  if (!field) return { ok: false, error: "No Status field on the board." };
  const option = field.options.find((o) => o.name.toLowerCase() === statusName.toLowerCase());
  if (!option) {
    return { ok: false, error: `Unknown status "${statusName}". Options: ${field.options.map((o) => o.name).join(", ")}.` };
  }
  await gql(
    `mutation($project: ID!, $item: ID!, $field: ID!, $opt: String!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $project, itemId: $item, fieldId: $field,
        value: { singleSelectOptionId: $opt }
      }) { projectV2Item { id } }
    }`,
    { project: projectId(), item: itemId, field: field.fieldId, opt: option.id },
  );
  return { ok: true, status: option.name };
}
