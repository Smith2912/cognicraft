
import { Project, NodeData, EdgeData, NodeStatus } from '../types';

const getNodeEmoji = (iconId?: string): string => {
  if (!iconId) return '📄'; 
  switch (iconId.toLowerCase()) {
    case 'github': return '🐙';
    case 'database': return '💾';
    case 'api': return '🔗';
    case 'frontend': return '🖥️';
    case 'bug': return '🐛';
    case 'feature': return '💡';
    case 'gear': return '⚙️';
    default:
      return '📄';
  }
};

const getStatusMarkdown = (status: NodeStatus): string => {
  switch (status) {
    case NodeStatus.Done: return '[x]';
    case NodeStatus.InProgress: return '[/]';
    default: return '[ ]';
  }
};

const formatNodeDescriptionForSection = (description: string, indentLevel: number = 1): string => {
  const indent = '  '.repeat(indentLevel);
  return description.split('\n').map(line => `${indent}- ${line}`).join('\n');
};

const renderNodeMarkdownRecursive = (
  node: NodeData,
  level: number,
  allNodes: NodeData[],
  allEdges: EdgeData[],
  renderedNodeIds: Set<string>,
  specialNodeIds: Set<string> // Nodes already handled in specific sections
): string => {
  if (renderedNodeIds.has(node.id) || specialNodeIds.has(node.id)) {
    return ''; 
  }
  renderedNodeIds.add(node.id);

  const indent = '  '.repeat(level);
  let markdown = `${indent}${getStatusMarkdown(node.status)} **${node.title}**`;

  const details = [];
  if (node.iconId) details.push(`Icon: ${getNodeEmoji(node.iconId)}`);
  details.push(`Status: ${node.status}`);
  if (node.tags && node.tags.length > 0) details.push(`Tags: ${node.tags.join(', ')}`);
  
  markdown += ` (${details.join(', ')})\n`;

  if (node.githubIssueUrl) {
    markdown += `${indent}  - GitHub Issue: [View Issue](${node.githubIssueUrl})\n`;
  }

  if (node.description) {
    const descriptionLines = node.description.split('\n');
    descriptionLines.forEach(line => {
      markdown += `${indent}  > ${line}\n`;
    });
  }

  const childEdges = allEdges.filter(edge => edge.sourceId === node.id);
  if (childEdges.length > 0) {
    const childNodes = childEdges.map(edge => allNodes.find(n => n.id === edge.targetId)).filter(Boolean) as NodeData[];
    const nonSpecialChildNodes = childNodes.filter(cn => !specialNodeIds.has(cn.id));

    if (nonSpecialChildNodes.length > 0) {
        markdown += `${indent}  - Subtasks:\n`;
        nonSpecialChildNodes.forEach(childNode => {
            markdown += renderNodeMarkdownRecursive(childNode, level + 2, allNodes, allEdges, renderedNodeIds, specialNodeIds);
        });
    }
  }
  markdown += '\n'; 
  return markdown;
};

export const generatePlanMarkdown = (
  project: Project,
  nodes: NodeData[],
  edges: EdgeData[]
): string => {
  let markdown = `# Project: ${project.name} - Development Specification\n`;
  if (project.githubRepoUrl) {
    markdown += `GitHub Repository: [${project.githubRepoUrl}](${project.githubRepoUrl})\n`;
  }
  if (project.teamMemberUsernames && project.teamMemberUsernames.length > 0) {
    markdown += `Team: ${project.teamMemberUsernames.join(', ')}\n`;
  }
  markdown += `Generated: ${new Date().toLocaleDateString()}\n`;
  markdown += '---\n';

  markdown += `
## Purpose of this Document
This document is intended as a comprehensive specification for the "${project.name}" project. It aims to provide sufficient detail to be used as a "one-shot" prompt for an advanced AI code generation tool, or as a detailed guide for a development team.
Details for sections like Core Technologies, Data Models, API Endpoints, etc., should be populated based on specific nodes created for these purposes (e.g., a node titled "Technology Stack" or "Data Model: User").
\n`;

  const specialNodeIds = new Set<string>();

  // --- Core Technologies ---
  markdown += `## 1. Core Technologies\n`;
  const techStackNode = nodes.find(n => n.title.toLowerCase().includes('technology stack') || n.title.toLowerCase().includes('tech stack'));
  if (techStackNode) {
    markdown += `${techStackNode.description}\n\n`;
    specialNodeIds.add(techStackNode.id);
  } else {
    markdown += `(Placeholder: Describe core languages, frameworks, database, and other key technologies here. E.g., Node.js with Express.js, PostgreSQL, React, etc. Consider creating a node titled "Technology Stack" and detailing this information in its description.)\n\n`;
  }

  // --- Data Models ---
  markdown += `## 2. Data Models (Database Schema)\n`;
  const dataModelNodes = nodes.filter(n => n.title.toLowerCase().startsWith('data model:') || n.title.toLowerCase().startsWith('schema:'));
  if (dataModelNodes.length > 0) {
    dataModelNodes.forEach((dmNode, index) => {
      const entityName = dmNode.title.split(/:(.*)/s)[1]?.trim() || 'Unknown Entity';
      markdown += `### 2.${index + 1}. ${entityName}\n`;
      markdown += `${formatNodeDescriptionForSection(dmNode.description)}\n\n`;
      specialNodeIds.add(dmNode.id);
    });
  } else {
    markdown += `(Placeholder: Detail each data entity, its fields, types, relationships. E.g., Users table, Products table, etc. Create nodes titled "Data Model: [Entity Name]" or "Schema: [Entity Name]" with descriptions listing fields like 'id: UUID (PK)', 'name: STRING', etc.)\n\n`;
  }

  // --- API Endpoints ---
  markdown += `## 3. API Endpoints\n`;
  const apiNodes = nodes.filter(n => n.title.toLowerCase().startsWith('api:'));
  if (apiNodes.length > 0) {
    apiNodes.forEach((apiNode, index) => {
      const endpointName = apiNode.title.split(/:(.*)/s)[1]?.trim() || 'Unknown Endpoint';
      markdown += `### 3.${index + 1}. ${endpointName}\n`;
      markdown += `  - **Description:** ${apiNode.description.split('\n')[0]}\n`; // First line as main desc
      if (apiNode.description.includes('\n')) {
        markdown += `  - **Details:**\n${formatNodeDescriptionForSection(apiNode.description.substring(apiNode.description.indexOf('\n') + 1), 2)}\n`;
      }
      
      const childEdges = edges.filter(edge => edge.sourceId === apiNode.id);
      if (childEdges.length > 0) {
        markdown += `  - **Implementation Subtasks:**\n`;
        childEdges.forEach(edge => {
          const childNode = nodes.find(n => n.id === edge.targetId);
          if (childNode) {
            markdown += `    - ${getStatusMarkdown(childNode.status)} ${childNode.title}: ${childNode.description.split('\n')[0]}\n`;
          }
        });
      }
      markdown += `\n`;
      specialNodeIds.add(apiNode.id);
    });
  } else {
    markdown += `(Placeholder: Define all API endpoints, including HTTP method, path, request body, response structure, and purpose. Create nodes titled "API: [METHOD /path]" and detail these in their descriptions.)\n\n`;
  }

  // --- Authentication & Authorization ---
  markdown += `## 4. Authentication & Authorization\n`;
  const authNode = nodes.find(n => n.title.toLowerCase().includes('authentication') || n.title.toLowerCase().includes('authorization') || n.title.toLowerCase().includes('auth strategy'));
  if (authNode) {
    markdown += `${authNode.description}\n\n`;
    specialNodeIds.add(authNode.id);
  } else {
    markdown += `(Placeholder: Describe the authentication mechanism (e.g., JWT, OAuth) and authorization rules (e.g., user roles, permissions). Create a node for this, e.g., "Authentication Strategy".)\n\n`;
  }

  // --- Task Breakdown / Feature Implementation Plan ---
  markdown += `## 5. Task Breakdown / Feature Implementation Plan\n\n`;
  const renderedNodeIds = new Set<string>();
  const generalNodes = nodes.filter(node => !specialNodeIds.has(node.id));
  
  const rootGeneralNodes = generalNodes.filter(node => !edges.some(edge => edge.targetId === node.id && generalNodes.find(n => n.id === edge.sourceId)));

  const nodesToRenderInitially = rootGeneralNodes.length > 0 ? rootGeneralNodes : generalNodes.filter(n => !edges.some(e => e.targetId === n.id)); // Fallback for fully connected general graphs

  nodesToRenderInitially.forEach(node => {
    if (!renderedNodeIds.has(node.id)) { // Check if not already rendered (e.g. as a child of another general node)
         markdown += renderNodeMarkdownRecursive(node, 0, nodes, edges, renderedNodeIds, specialNodeIds);
    }
  });
  
  // Handle any general nodes not reached (e.g. part of cycles or disconnected from initial roots)
  generalNodes.forEach(node => {
    if (!renderedNodeIds.has(node.id)) {
      markdown += renderNodeMarkdownRecursive(node, 0, nodes, edges, renderedNodeIds, specialNodeIds);
    }
  });
  
  if (generalNodes.length === 0) {
    markdown += "(No general tasks defined or all tasks were categorized into specific sections above.)\n\n";
  }


  // --- Key Considerations & Future Work ---
  markdown += `## 6. Key Considerations & Future Work\n`;
  const considerationsNode = nodes.find(n => n.title.toLowerCase().includes('considerations') || n.title.toLowerCase().includes('future work'));
  if (considerationsNode) {
    markdown += `${considerationsNode.description}\n\n`;
    specialNodeIds.add(considerationsNode.id);
  } else {
    markdown += `(Placeholder: List any non-obvious design choices, potential challenges, or ideas for future enhancements. Create a node for this, e.g., "Key Considerations".)\n\n`;
  }

  return markdown;
};
