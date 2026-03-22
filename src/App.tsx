import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  Edge,
  Node,
  ReactFlowProvider,
  MiniMap,
  getNodesBounds,
  Panel,
  useUpdateNodeInternals
} from "reactflow";
import "reactflow/dist/style.css";
import { v4 as uuidv4 } from 'uuid';

import { ContextMenu, CustomPanel, Palette } from "./components";
import Toolbar from "./components/toolbar";
import { nodesConfig, tutorial } from "./config/site";
import { useStore } from "./config/store";
import { useShallow } from "zustand/react/shallow";
import { handleDragOver, handleOnDrop } from "./lib/utils";
import useKeyBindings from "./hooks/useKeyBindings";
import { toSvg } from "html-to-image";
import { initialDiagram } from "./config/site";
import Modal, { NewDiagramModal } from "./Modal";
import './index.css';
import { Placement } from 'react-joyride';
import { startCompile } from "./backend";
import { ancillaConstructColor, classicalConstructColor, ClassicalOperatorNode, controlFlowConstructColor, grover, hadamard_test_imaginary_part, hadamard_test_real_part, qaoa, quantum_types, quantumConstructColor, swap_test, custom_template, TEMPLATE_STORAGE_KEY, templates } from "./constants";
import Joyride from 'react-joyride';
import { ConfigModal } from "./components/modals/configModal";
import { QunicornModal } from "./components/modals/qunicornModal";
import { SendRequestModal } from "./components/modals/backendModal";
import { Toast } from "./components/modals/toast";
import ExperienceModePanel from "./components/modals/experienceLevelModal";
import { HistoryItem, HistoryModal } from "./components/modals/historyModal";
import { ValidationModal } from "./components/modals/validationModal";
import AiModal from "./components/modals/aiModal";
import OpenAI from "openai";
import { grover_algorithm, hadamard_test_imaginary_part_algorithm, hadamard_test_real_part_algorithm, qaoa_algorithm, swap_test_algorithm } from "./constants/templates";
import JSZip, { JSZipObject } from "jszip";
import { createDeploymentModel, createNodeType, createServiceTemplate, updateNodeType, updateServiceTemplate } from "./winery";
import custom from "./components/nodes/custom";
import { Template } from "./components/panels/categories";
import { ManageTemplateModal } from "./components/modals/templateModal";
import { v4 as uuid } from "uuid";
import { PatternSelectionModal } from "./components/modals/patternSelectionModal";
import { PatternImplementationSelectionModal } from "./components/modals/patternImplementationSelectionModal";

const selector = (state: {
  nodes: Node[];
  edges: Edge[];
  ancillaMode: boolean;
  experienceLevel: string;
  compact: boolean;
  completionGuaranteed: boolean;
  containsPlaceholder: boolean;
  onNodesChange: any;
  onEdgesChange: any;
  onConnect: any;
  onConnectEnd: any;
  typeError: string | null;
  userTemplates: Template[];
  setTypeError: (message: string | null) => void;
  setSelectedNode: (node: Node | null) => void;
  updateNodeValue: (nodeId: string, field: string, nodeVal: string) => void;
  updateParent: (nodeId: string, parentId: string, position: any) => void;
  updateChildren: (nodeId: string, children: any) => void;
  setNodes: (node: Node) => void;
  setEdges: (edge: Edge) => void;
  setAncillaMode: (ancillaMode: boolean) => void;
  setCompact: (compact: boolean) => void;
  setCompletionGuaranteed: (completionGuaranteed: boolean) => void;
  setExperienceLevel: (experienceLevel: string) => void;
  addUserTemplate: (template: Template) => void;
  setUserTemplates: (newTemplates: Template[]) => void;
  setContainsPlaceholder: (containsPlaceholder: boolean) => void;
  undo: () => void;
  redo: () => void;
}) => ({
  nodes: state.nodes,
  edges: state.edges,
  experienceLevel: state.experienceLevel,
  compact: state.compact,
  completionGuaranteed: state.completionGuaranteed,
  containsPlaceholder: state.containsPlaceholder,
  onNodesChange: state.onNodesChange,
  onEdgesChange: state.onEdgesChange,
  onConnect: state.onConnect,
  onConnectEnd: state.onConnectEnd,
  typeError: state.typeError,
  userTemplates: state.userTemplates,
  setTypeError: state.setTypeError,
  setSelectedNode: state.setSelectedNode,
  updateNodeValue: state.updateNodeValue,
  updateParent: state.updateParent,
  updateChildren: state.updateChildren,
  setNodes: state.setNodes,
  setEdges: state.setEdges,
  setAncillaMode: state.setAncillaMode,
  setCompact: state.setCompact,
  setCompletionGuaranteed: state.setCompletionGuaranteed,
  setContainsPlaceholder: state.setContainsPlaceholder,
  setExperienceLevel: state.setExperienceLevel,
  addUserTemplate: state.addUserTemplate,
  setUserTemplates: state.setUserTemplates,
  undo: state.undo,
  redo: state.redo,
});

function App() {
  const reactFlowWrapper = React.useRef<any>(null);
  const [reactFlowInstance, setReactFlowInstance] = React.useState<any>(null);
  const {
    nodes,
    edges,
    experienceLevel,
    compact,
    completionGuaranteed,
    containsPlaceholder,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onConnectEnd,
    typeError,
    userTemplates,
    addUserTemplate,
    setUserTemplates,
    setTypeError,
    setCompact,
    setExperienceLevel,
    setAncillaMode,
    setCompletionGuaranteed,
    setContainsPlaceholder,
    setSelectedNode,
    setNodes,
    updateNodeValue,
    updateParent,
    updateChildren,
    setEdges,
  } = useStore(useShallow(selector));



  const [metadata, setMetadata] = React.useState<any>({
    version: "1.0.0",
    name: "My Model",
    description: "This is a model.",
    author: ""
  });
  const [menu, setMenu] = useState(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isManageTemplatesOpen, setIsManageTemplatesOpen] = useState(false);
  const [nisqAnalyzerEndpoint, setNisqAnalyzerEndpoint] = useState(
    import.meta.env.VITE_NISQ_ANALYZER || "http://localhost:8098/nisq-analyzer"
  );
  const [camundaEndpoint, setCamundaEndpoint] = useState(
    import.meta.env.VITE_CAMUNDA7_ENDPOINT || "http://localhost:8090/engine-rest"
  );

  const [openAIToken, setOpenAIToken] = useState(
    import.meta.env.VITE_OPENAI_TOKEN
  );
  const [qunicornEndpoint, setQunicornEndpoint] = useState(
    import.meta.env.VITE_QUNICORN || "http://localhost:8080"
  );
  const [lowcodeBackendEndpoint, setLowcodeBackendEndpoint] = useState(
    import.meta.env.VITE_LOW_CODE_BACKEND || "http://localhost:8000"
  );

  const [patternAtlasApiEndpoint, setPatternAtlasApiEndpoint] = useState(
    import.meta.env.VITE_PATTERN_ATLAS_API || "http://localhost:1977/patternatlas/patternLanguages/af7780d5-1f97-4536-8da7-4194b093ab1d"
  );
  const [patternAtlasUiEndpoint, setPatternAtlasUiEndpoint] = useState(
    import.meta.env.VITE_PATTERN_ATLAS_UI || "http://localhost:1978"
  );
  const [qcAtlasEndpoint, setQcAtlasEndpoint] = useState(
    import.meta.env.VITE_QC_ATLAS || "http://localhost:6626"
  );


  const [activeTab, setActiveTab] = useState("editor");
  const [warningExecution, setWarningExecution] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    nodeId: string | null;
    top: number;
    left: number;
  }>({
    visible: false,
    nodeId: null,
    top: 0,
    left: 0,
  });

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setContextMenu({
        visible: true,
        nodeId: node.id,
        top: event.clientY,
        left: event.clientX,
        //top: node.position.y+0.5*node.height, //passt nicht
        //left: node.position.x-0.5*node.width, //passt nicht
      });
    },
    []
  );

  const onEdgesDelete = (edges: Edge[]) => {
    edges.forEach((edge) => {
      console.log("ON EDGES DELETE")
      console.log("EDGE", edge)
      const targetNodeId = edge.target
      const targetHandle = edge.targetHandle
      const targetNode = nodes.find(n => n.id === targetNodeId);
      const newInputs = targetNode.data.inputs.filter(i => i.targetHandle !== targetHandle)
      updateNodeValue(targetNodeId, "inputs", newInputs)
      console.log(targetHandle)
      console.log("update new inputs", newInputs)
      console.log("NEW INPUTS", targetNode.data.inputs)
    })
  };



  const handleAction = (action: string, nodeId: string) => {
    console.log(`Action: ${action} on Node: ${nodeId}`);
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };


  const [validationResult, setValidationResult] = useState({ warnings: [], errors: [] });
  const [isValidationOpen, setIsValidationOpen] = useState(false);
  const [githubRepositoryOwner, setGithubRepositoryOwner] = useState(import.meta.env.VITE_GITHUB_REPO_OWNER);
  const [githubRepositoryName, setGithubRepositoryName] = useState(import.meta.env.VITE_GITHUB_REPO_NAME);
  const [githubBranch, setGithubBranch] = useState(import.meta.env.VITE_GITHUB_REPO_BRANCH);
  const [githubToken, setGithubToken] = useState(import.meta.env.VITE_GITHUB_TOKEN);
  const [openqasmCode, setOpenQASMCode] = useState("");

  const [selectedDevice, setSelectedDevice] = useState("aer_simulator");
  const [provider, setProvider] = useState("IBM");

  const [numShots, setNumShots] = useState(1024);
  const [accessToken, setAccessToken] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [errorJobMessage, setErrorJobMessage] = useState("");
  const [isPatternModalOpen, setIsPatternModalOpen] = useState(false);
  const [isPatternImplementationOpen, setIsPatternImplementationOpen] = useState(false);
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);



  const [isLoadJsonModalOpen, setIsLoadJsonModalOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(true);
  const [chartData, setChartData] = useState(null);
  const [progress, setProgress] = useState(0);
  const [executed, setAlreadyExecuted] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [quantumAlgorithmModalStep, setQuantumAlgorithmModalStep] = useState(0);
  const [quantumAlgorithms, setQuantumAlgorithms] = useState([
    { name: "Quantum Approximate Optimization Algorithm (QAOA)", configCount: 0, patternGraphPng: "patterns/qaoa_patterngraph.png" },
    { name: "SWAP Test", configCount: 0, patternGraphPng: null },
    { name: "Hadamard Test", configCount: 0, patternGraphPng: null },
    { name: "Grover's Algorithm", configCount: 0, patternGraphPng: "patterns/grover_patterngraph.png" },
    { name: "Uniform Superposition", configCount: 0, patternGraphPng: null },
    { name: "Initialization", configCount: 0, patternGraphPng: "patterns/initialization_patterngraph.png" },
  ]);

  const [patternGraph, setPatternGraph] = useState(null);
  const [isDetectingAlgorithms, setIsDetectingAlgorithms] = useState(false);

  let client: OpenAI | null = null;
  try {
    if (openAIToken) {
      client = new OpenAI({ apiKey: openAIToken, dangerouslyAllowBrowser: true });
    }
  } catch (e) {
    console.warn("OpenAI init failed, continuing without it:", e);
    client = null;
  }

  /*
    const client = new OpenAI({
      apiKey: openAIToken, dangerouslyAllowBrowser: true
    });
  */


  const detectQuantumAlgorithms = async (userInput: string): Promise<string | null> => {
    try {
      setIsDetectingAlgorithms(true);

      const algorithms = [
        "Quantum Approximate Optimization Algorithm (QAOA)",
        "Variational Quantum Eigensolver (VQE)",
        "Grover's Algorithm",
        "Quantum Phase Estimation (QPE)",
        "Quantum Fourier Transform (QFT)",
        "SWAP Test",
        "Hadamard Test",
        "Quantum Classification",
        "Quantum Clustering",
        "Basis Encoding",
        "Matrix Encoding",
        "Amplitude Encoding",
        "Angle Encoding",
        "Initialization",
        "Dynamic Circuits"
      ];

      setQuantumAlgorithms(quantumAlgorithms);

      let response;
      try {
        response = await client.responses.create({
          model: "gpt-5-nano",
          input: [
            {
              role: "system",
              content: `
You are a quantum computing expert.
Given a problem description, identify applicable quantum algorithms.

Check first if some algorithms from this list match:
${algorithms.join(", ")}

Add then the other matches. The first algorithm should be the most suitable one.

Return JSON ONLY in this exact format:
{
  "algorithms": ["<algorithm name>", "..."]
}
If none apply, return { "algorithms": [] }.
            `,
            },
            { role: "user", content: userInput },
          ],
        });

        if (!response?.output_text) {
          setQuantumAlgorithms(quantumAlgorithms);
          return null;
        }

        const parsed = JSON.parse(response.output_text);

        if (!Array.isArray(parsed.algorithms)) throw new Error("Invalid response format");

        setQuantumAlgorithms(parsed.algorithms.map((name: string) => ({ name })));

        return null;
      } catch (sendError: any) {
        console.error("OpenAI request failed:", sendError);
        setQuantumAlgorithms(quantumAlgorithms);
        return sendError.message || "Unknown error";
      }
    } finally {
      setIsDetectingAlgorithms(false);
    }
  };


  function viewPatternGraph(algo) {
    setPatternGraph(algo.patternGraphPng);
  }


  const handleQuantumAlgorithmModalClose = () => {
    setQuantumAlgorithmModalStep(0);
  }


  globalThis.setCamundaEndpoint = setCamundaEndpoint;
  globalThis.setNisqAnalyzerEndpoint = setNisqAnalyzerEndpoint;
  globalThis.setQunicornEndpoint = setQunicornEndpoint;
  globalThis.setLowcodeBackendEndpoint = setLowcodeBackendEndpoint;
  globalThis.setPatternAtlasUiEndpoint = setPatternAtlasUiEndpoint;
  globalThis.setPatternAtlasApiEndpoint = setPatternAtlasApiEndpoint;
  globalThis.setQcAtlasEndpoint = setQcAtlasEndpoint;
  globalThis.setGithubRepositoryOwner = setGithubRepositoryOwner;
  globalThis.setGithubRepositoryName = setGithubRepositoryName;
  globalThis.setGithubBranch = setGithubBranch;
  globalThis.setGithubToken = setGithubToken;

  const togglePalette = () => {
    setIsPaletteOpen((prev) => !prev);
  };

  const [isPanelOpen, setIsPanelOpen] = useState(true);

  const togglePanel = () => {
    setIsPanelOpen((prev) => !prev);
  };
  const handleLoadJson = () => {
    if (nodes.length > 0) {
      setIsLoadJsonModalOpen(true);
    }
  };

  const confirmNewDiagram = () => {
    setIsLoadJsonModalOpen(false);
    overwriteFlow(initialDiagram);
  };

  const handleSave = (newValues) => {
    console.log(newValues)
    setCamundaEndpoint(newValues.tempCamundaEndpoint);
    setNisqAnalyzerEndpoint(newValues.tempNisqAnalyzerEndpoint);
    setOpenAIToken(newValues.tempOpenAIToken);
    setQunicornEndpoint(newValues.tempQunicornEndpoint);
    setLowcodeBackendEndpoint(newValues.tempLowcodeBackendEndpoint);
    setPatternAtlasUiEndpoint(newValues.tempPatternAtlasUiEndpoint);
    setPatternAtlasApiEndpoint(newValues.tempPatternAtlasApiEndpoint);
    setQcAtlasEndpoint(newValues.tempQcAtlasEndpoint);
    setGithubRepositoryOwner(newValues.tempGithubRepositoryOwner);
    setGithubRepositoryName(newValues.tempGithubRepositoryName);
    setGithubBranch(newValues.tempGithubBranch);
    setGithubToken(newValues.tempGithubToken);

    setCompact(newValues.compactVisualization);
    setCompactVisualization(newValues.compactVisualization);
    setAncillaMode(newValues.ancillaMode);
    setAncillaModelingOn(newValues.ancillaMode);
    setExperienceLevel(newValues.experienceLevel);
    setCompletionGuaranteed(newValues.completionGuaranteed);

    setIsConfigOpen(false);
  };

  const handleManageTemplatesSave = (updatedTemplates) => {
    console.log("saving user template changes.");
    console.log(updatedTemplates);
    setUserTemplates(updatedTemplates);
    setIsManageTemplatesOpen(false);
  };



  const cancelLoadJson = () => {
    setIsLoadJsonModalOpen(false);
  };
  const [helperLines, setHelperLines] = useState(null);
  const [deploymentId, setDeploymentId] = useState(null);

  const [expanded, setExpanded] = useState(false);
  const [completionGuaranteedOption, setCompletionGuaranteedOption] = useState("Yes");

  const { undo } = useStore((state) => ({
    undo: state.undo,
  }));

  const { redo } = useStore((state) => ({
    redo: state.redo,
  }));

  const ref = useRef(null);

  const onDragOver = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      handleDragOver(event);
    },
    [],
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [modalStep, setModalStep] = useState(1);
  const [isQunicornOpen, setIsQunicornOpen] = useState(false);
  const [loadingQunicorn, setLoadingQunicorn] = useState(true);
  const [statusQunicorn, setStatusQunicorn] = useState(null);
  const [ancillaModelingOn, setAncillaModelingOn] = useState(false);
  const [experienceLevelOn, setExperienceLevelOn] = useState("explorer");
  const [compactVisualization, setCompactVisualization] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [workflow, setWorkflow] = useState("");


  const updateNodeInternals = useUpdateNodeInternals();

  const showToast = (message: string, type: "success" | "error" | "info") => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (typeError) {
      showToast(typeError, "error");
    }
  }, [typeError, showToast, setTypeError]);

  const [runTour, setRunTour] = useState(false);
  const [joyrideStepId, setJoyRideStepId] = useState(0);

  const joyrideSteps: {
    target: string;
    content: string;
    placement?: Placement;
  }[] = [
      {
        target: '.toolbar-container',
        content: 'This is the toolbar where you can save, restore, or send your diagrams.',
      },
      {
        target: '.backend-button',
        content: 'This transforms the model into QASM code or workflows, which can then be executed on quantum devices or on a workflow engine.',
      },
      {
        target: '.palette-container',
        content: 'This is the palette, where you can drag and drop blocks. Quantum blocks are depicted in blue and classical blocks are depicted in orange.',
        placement: "right"
      },
      {
        target: '.react-flow__pane',
        content: 'This is the main diagram canvas.',
        placement: "top-start"
      },
      {
        target: '.experience-mode',
        content: 'This panel allows you to configure the editor based on your preferences.',
        placement: "right"
      },
      {
        target: '.classical-node',
        content: 'This is a classical node that requires a value.',

      },
      {
        target: '.grand-parent',
        content: 'This value is then encoded via the state preparation block into a quantum state.',

      },
      {
        target: '.currentPanel-container',
        content: 'This is the properties panel, where you can configure the properties of blocks or the model.',
        placement: "left"
      }
    ];

  const [isProcessingModalOpen, setProcessingModalOpen] = useState(false);

  // TODO: Change here to workflow
  const [compilationTarget, setCompilationTarget] = useState("qasm");
  const handleClose = () => {
    // reset all values
    setIsQunicornOpen(false);
    setModalStep(1);
    setChartData(null);
    setErrorMessage("");
    setErrorJobMessage("");
    setJobId(null);
    setDeploymentId(null);
    setProgress(0);
    setWarningExecution(false);
    //setSelectedDevice("");
    //setProvider("");
    setNumShots(1024);
    setAccessToken("");
    setAlreadyExecuted(false);
  };

  const sendToBackend = async () => {
    //setLoading(true);
    setModalOpen(false);
    setProcessingModalOpen(true);

    let id = `flow-${Date.now()}`;
    if (compilationTarget === "qasm") {
      showToast("QASM request for model " + id + " submitted.", "info");
    } else {
      showToast("Workflow request for model " + id + " submitted.", "info");
    }



    try {
      const validMetadata = {
        ...metadata,
        containsPlaceholder: containsPlaceholder,
        id: id,
        timestamp: new Date().toISOString(),
      };

      console.log(validMetadata);
      console.log(metadata);

      const response = await startCompile(
        lowcodeBackendEndpoint,
        validMetadata,
        reactFlowInstance.getNodes(),
        reactFlowInstance.getEdges(),
        compilationTarget
      );
      console.log(response)

      const jsonData = await response.json();
      const uuid = jsonData["uuid"];
      let location = jsonData["result"];
      const statusUrl = `${lowcodeBackendEndpoint}/status/${uuid}`;

      console.log("Initial compile response:", jsonData);

      // Polling function returns a Promise
      const pollStatus = () => {
        return new Promise<void>((resolve, reject) => {
          let attempts = 0;
          const maxAttempts = 20;
          const delay = 10000;

          const check = async () => {
            try {
              const statusResponse = await fetch(statusUrl, {
                method: "GET",
                headers: { "Content-Type": "application/json" },
              });

              if (!statusResponse.ok) {
                console.error("Status check failed:", statusResponse.status);
                return reject("Status check failed");
              }

              const statusData = await statusResponse.json();
              console.log("Current status:", statusData.status);
              setStatus(statusData.status);
              location = statusData["result"];

              if (statusData.status === "completed") {
                //showToast("Result for model " + id + " is available.", "success");
                console.log("Operation completed successfully.");
                return resolve();
              }

              attempts++;
              if (attempts < maxAttempts) {
                setTimeout(check, delay);
              } else {
                console.error("Max polling attempts reached. Operation did not complete.");
                showToast("Max polling attempts for model " + id + " reached.", "error");
                reject("Max polling attempts reached");
              }
            } catch (error) {
              console.error("Error while polling status:", error);
              reject(error);
            }
          };

          check();
        });
      };

      // Wait for polling to complete
      await pollStatus();

      console.log("Fetching final result from:", location);

      const result = await fetch(location, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      // TODO: change for workflow
      // TODO: add modals for service deployment
      // TODO: add QRMS upload
      const openqasmCode = await result.text();
      console.log("Received OpenQASM code:", openqasmCode);

      setOpenQASMCode(openqasmCode);
      setTimeout(() => {
        setStatus("completed");
        setLoading(false);
        showToast("Result for model " + id + " is available.", "success");
        setModalOpen(true);  
      }, 3000);
      setStatus("completed");
      setLoading(false);


    } catch (error) {
      console.error("Error sending data:", error);
      showToast("Error during result generation for model " + id + ".", "error");
      setLoading(false);
    }
  };

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isHistoryOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch(`${lowcodeBackendEndpoint}/results`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        console.error("Failed to fetch history:", response.statusText);
        return;
      }

      const data: HistoryItem[] = await response.json();
      console.log(data)
      setHistory(data);
    } catch (err) {
      console.error("Error fetching history:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const openHistoryModal = async () => {
    await fetchHistory();
    setHistoryOpen(true);
  };

  const startTour2 = () => {
    setRunTour(true);
    setAncillaMode(false);
    setAncillaModelingOn(false);
    //updateNodeInternals since ancilla mode changes number of handles
    nodes.forEach((node) => {
      updateNodeInternals(node.id);
    })
    console.log("load tutorial")
    overwriteFlow(tutorial);
    console.log("load toturial")
  }

  interface ValidationItem {
    nodeId: string;
    nodeType: string;
    description: string;
  }

  interface ValidationResult {
    warnings: ValidationItem[];
    errors: ValidationItem[];
  }

  function validateFlow(flow): ValidationResult {
    const warnings: ValidationItem[] = [];
    const errors: ValidationItem[] = [];

    const outputIds = new Map<string, string>();
    const nodesById: any = new Map(flow.nodes?.map((n) => [n.id, n]));

    // Map targetNodeId => sourceNodeIds[]
    const nodeConnections = new Map<string, string[]>();
    flow.edges?.forEach((edge) => {
      if (!nodeConnections.has(edge.target)) nodeConnections.set(edge.target, []);
      nodeConnections.get(edge.target)?.push(edge.source);
    });

    console.log(flow.edges)

    // Map sourceNodeId => targetNodeIds[] for output checks
    const outgoingConnections = new Map<string, string[]>();
    flow.edges?.forEach((edge) => {
      if (!outgoingConnections.has(edge.source)) outgoingConnections.set(edge.source, []);
      outgoingConnections.get(edge.source)?.push(edge.target);
    });

    // Existing node validation 
    flow.nodes?.forEach((node) => {
      const { outputIdentifier, label, inputs, outputSize, condition, operator } =
        node.data || {};
      const connectedSources = nodeConnections.get(node.id) || [];
      const inputCount = connectedSources.length;

      const hasQuantumOutput = connectedSources.some((srcId) => {
        const sourceNode: any = nodesById.get(srcId);
        return sourceNode !== undefined;
      });

      // Output Identifier Checks 
      if (outputIdentifier && /^[0-9]/.test(outputIdentifier)) {
        errors.push({
          nodeId: node.id,
          nodeType: node.type,
          description: `Invalid outputIdentifier "${outputIdentifier}" (cannot start with a number).`,
        });
      }

      if (outputIdentifier) {
        if (outputIds.has(outputIdentifier)) {
          const firstNodeId = outputIds.get(outputIdentifier);
          errors.push({
            nodeId: node.id,
            nodeType: node.type,
            description: `Duplicate outputIdentifier "${outputIdentifier}" already used by node "${firstNodeId}".`,
          });
        } else {
          outputIds.set(outputIdentifier, node.id);
        }
      }

      // Gate / Operator Validation 
      const twoQubitGates = [
        "CNOT",
        "SWAP",
        "CZ",
        "CY",
        "CH",
        "CP(λ)",
        "CRX(θ)",
        "CRY(θ)",
        "CRZ(θ)",
        "CU(θ,φ,λ,γ)",
      ];
      const threeQubitGates = ["Toffoli", "CSWAP"];
      const minMaxOperators = ["Min", "Max"];

      if (
        twoQubitGates.includes(label) ||
        ((node.type === "quantumOperatorNode" || node.type === "classicalOperatorNode") &&
          !minMaxOperators.includes(operator))
      ) {
        if (inputCount !== 2) {
          errors.push({
            nodeId: node.id,
            nodeType: node.type,
            description: `Node "${node.id}" with label "${label}" requires exactly 2 inputs, but got ${inputCount}.`,
          });
        }
        if (node.data.label === "Quantum Comparison Operator" || node.data.label === "Quantum Min & Max Operator") {
          warnings.push({
            nodeId: node.id,
            nodeType: node.type,
            description: `Node "${node.id}" (${node.data.label}) produces a classical output but its output is not used.`,
          });
        } else if (!twoQubitGates.includes(label) && !hasQuantumOutput) {
          warnings.push({
            nodeId: node.id,
            nodeType: node.type,
            description: `Node "${node.id}" (${node.data.label}) produces a quantum state but its output is not used.`,
          });
        }

      }

      if (threeQubitGates.includes(label)) {
        if (inputCount !== 3) {
          errors.push({
            nodeId: node.id,
            nodeType: node.type,
            description: `Gate "${label}" requires exactly 3 inputs, but got ${inputCount}.`,
          });
        }
      }

      if (
        minMaxOperators.includes(label) ||
        (node.type === "gateNode" &&
          label !== "Qubit Circuit" &&
          !threeQubitGates.includes(label) &&
          !twoQubitGates.includes(label))
      ) {
        if (inputCount < 1) {
          errors.push({
            nodeId: node.id,
            nodeType: node.type,
            description: `Operator "${label}" requires at least 1 input.`,
          });
        }

        // Warn if Min/Max operator has no output connection 
        const outgoing = outgoingConnections.get(node.id) || [];
        if (outgoing.length === 0) {
          warnings.push({
            nodeId: node.id,
            nodeType: node.type,
            description: `Operator "${label}" has no output connection (unused result).`,
          });
        }
      }

      // State Preparation Node 
      if (node.type === "statePreparationNode") {
        if (
          ["Encode Value", "Basis Encoding", "Angle Encoding", "Amplitude Encoding"].includes(
            node.data.label
          )
        ) {
          const hasClassical = connectedSources.some((srcId) => {
            const sourceNode: any = nodesById.get(srcId);
            return sourceNode?.type === "dataTypeNode";
          });
          if (!hasClassical) {
            errors.push({
              nodeId: node.id,
              nodeType: node.type,
              description: `Node "${node.id}" has no classical data input connected.`,
            });
          }
          if (node.data.encodingType === "Custom Encoding" && !node.data.implementation) {
            errors.push({
              nodeId: node.id,
              nodeType: node.type,
              description: `Node "${node.id}" is missing an implementation for custom encoding.`,
            });
          }
        }

        if (node.data.label === "Prepare State") {
          if (!node.data.size) {
            errors.push({
              nodeId: node.id,
              nodeType: node.type,
              description: `Node "${node.id}" has no quantum register size specified.`,
            });
          }
          if (node.data.quantumStateName === "Custom State" && !node.data.implementation) {
            errors.push({
              nodeId: node.id,
              nodeType: node.type,
              description: `Node "${node.id}" is missing implementation for custom state.`,
            });
          }
        }


        const outgoing = outgoingConnections.get(node.id) || [];
        if (outgoing.length === 0) {
          warnings.push({
            nodeId: node.id,
            nodeType: node.type,
            description: `Node "${node.id}" has no output connection (unused quantum register).`,
          });
        }
      }

      // DataTypeNode: warn if no output connection 
      if (node.type === "dataTypeNode") {
        const outgoing = outgoingConnections.get(node.id) || [];
        if (outgoing.length === 0) {
          warnings.push({
            nodeId: node.id,
            nodeType: node.type,
            description: `Classical data node "${node.id}" has no output connection (unused variable).`,
          });
        }
      }

      // Measurement Node 
      if (node.type === "measurementNode") {
        const missingRegister = connectedSources.every((srcId) => {
          const sourceNode: any = nodesById.get(srcId);
          return sourceNode?.type !== "qubitNode" && sourceNode?.type !== "gateNode";
        });
        if (!node?.data?.indices) {
          warnings.push({
            nodeId: node.id,
            nodeType: node.type,
            description: `Node "${node.id}" has no specified indices.`,
          });
        } else if (!/^\d+(,\d+)*$/.test(node.data.indices)) {
          errors.push({
            nodeId: node.id,
            nodeType: node.type,
            description: `Indices of measurement node "${node.id}" can only contain numbers separated by commas.`,
          });
        }
      }

      // Control / If Nodes 
      if (node.type === "ifElseNode") {
        const hasClassical = connectedSources.some((srcId) => {
          const sourceNode: any = nodesById.get(srcId);
          return sourceNode?.type === "dataTypeNode";
        });
        if (!hasClassical) {
          errors.push({
            nodeId: node.id,
            nodeType: node.type,
            description: `Node "${label}" requires at least one classical data input.`,
          });
        }
        if (!condition) {
          errors.push({
            nodeId: node.id,
            nodeType: node.type,
            description: `Node "${label}" requires a condition.`,
          });
        }
      }

      if (node.type === "controlStructureNode" && !condition) {
        errors.push({
          nodeId: node.id,
          nodeType: node.type,
          description: `Node "${label}" requires a condition.`,
        });
      }

      // Algorithm / Custom Nodes 
      if (node.type === "algorithmNode" || node.type === "classicalAlgorithmNode") {
        const expectedInputs = node.data?.numberInputs || 0;
        const actualInputs = connectedSources.length;
        if (actualInputs < expectedInputs) {
          errors.push({
            nodeId: node.id,
            nodeType: node.type,
            description: `Node "${label}" requires ${expectedInputs} input(s), but only ${actualInputs} connected.`,
          });
        }


        // Quantum outputs check based on numberQuantumOutputs 
        const numberQuantumOutputs = node.data?.numberQuantumOutputs || 0;
        if (numberQuantumOutputs > 0) {
          const outgoing = outgoingConnections.get(node.id) || [];
          if (outgoing.length < numberQuantumOutputs) {
            warnings.push({
              nodeId: node.id,
              nodeType: node.type,
              description: `Node "${node.id}" produces ${numberQuantumOutputs} quantum outputs but only ${outgoing.length} are connected (some quantum outputs are unused).`,
            });
          }
        }
      }

    });

    // Gate node connection to measurement 
    const gateNodes = flow.nodes?.filter((n) => n.type === "gateNode") || [];
    const measurementNodes = new Set(
      flow.nodes?.filter((n) => n.type === "measurementNode").map((n) => n.id)
    );

    const visited = new Set<string>();
    function reachesMeasurement(nodeId: string): boolean {
      if (visited.has(nodeId)) return false;
      visited.add(nodeId);

      if (measurementNodes.has(nodeId)) return true;

      const outputs =
        flow.edges?.filter((e) => e.source === nodeId).map((e) => e.target) || [];
      return outputs.some((outId) => reachesMeasurement(outId));
    }

    const meaningfulGateExists = gateNodes.some((gate) => {
      visited.clear();
      return reachesMeasurement(gate.id);
    });

    if (!meaningfulGateExists && gateNodes.length > 0) {
      warnings.push({
        nodeId: null,
        nodeType: "flow",
        description:
          "No gate node in the model has a path to a measurement node. " +
          "Executing this flow will not produce meaningful results.",
      });
    }


    return { warnings, errors };
  }

  // Checks if there are any Nodes conflicting with QASM
  const [containsWorkflowNodes, setContainsWorkflowNodes] = useState(false);
  function checkContainsWorkflowNodes(flow): boolean {
    return flow.nodes?.some((node) => node.type == "plugin" || "file" || "string");
  };

  const startQuantumAlgorithmSelection = () => {
    setQuantumAlgorithmModalStep(1);
  }

  const handleOpenValidation = () => {
    if (!reactFlowInstance) return;

    const flow = reactFlowInstance.toObject();
    const result = validateFlow(flow);
    console.log(flow)

    setValidationResult(result);
    setIsValidationOpen(true);
  };


  const startTour3 = () => {
    overwriteFlow(modeledDiagram);
  }

  const startTour = () => {
    setRunTour(true);
    setAncillaMode(false);
    setAncillaModelingOn(false);
    //updateNodeInternals since ancilla mode changes number of handles
    nodes.forEach((node) => {
      updateNodeInternals(node.id);
    })
    console.log("load tutorial")
    console.log("load toturial")
  }
  const handleDeploy = async () => {
    setIsQunicornOpen(true);
    setLoading(true);
    console.log(qunicornEndpoint)

    try {
      let program = {
        "programs": [
          {
            //"quantumCircuit": "OPENQASM 2.0;\ninclude \"qelib1.inc\";\nqreg q[2];\ncreg meas[2];\nh q[0];\ncx q[0],q[1];\nbarrier q[0],q[1];\nmeasure q[0] -> meas[0];\nmeasure q[1] -> meas[1];",
            "quantumCircuit": openqasmCode,
            //"quantumCircuit": "OPENQASM 2.0;include 'qelib1.inc';qreg q[6];creg c[6];gate oracle(q0, q1, q2, q3, q4, q5) {    x q0;    x q1;    x q2;    x q3;    x q4;    x q5;        h q5;    ccx q3, q4, q5;    cx q2, q3;    cx q1, q2;    cx q0, q1;    h q5;    x q0;    x q1;    x q2;    x q3;    x q4;    x q5;}gate diffusion(q0, q1, q2, q3, q4, q5) {    h q0;    h q1;    h q2;    h q3;    h q4;    h q5;        x q0;    x q1;    x q2;    x q3;    x q4;    x q5;        h q5;    ccx q3, q4, q5;    cx q2, q3;    cx q1, q2;    cx q0, q1;    h q5;        x q0;    x q1;    x q2;    x q3;    x q4;    x q5;        h q0;    h q1;    h q2;    h q3;    h q4;    h q5;}h q[0];h q[1];h q[2];h q[3];h q[4];h q[5];oracle(q[0], q[1], q[2], q[3], q[4], q[5]);diffusion(q[0], q[1], q[2], q[3], q[4], q[5]);oracle(q[0], q[1], q[2], q[3], q[4], q[5]);diffusion(q[0], q[1], q[2], q[3], q[4], q[5]);oracle(q[0], q[1], q[2], q[3], q[4], q[5]);diffusion(q[0], q[1], q[2], q[3], q[4], q[5]);oracle(q[0], q[1], q[2], q[3], q[4], q[5]);diffusion(q[0], q[1], q[2], q[3], q[4], q[5]);oracle(q[0], q[1], q[2], q[3], q[4], q[5]);diffusion(q[0], q[1], q[2], q[3], q[4], q[5]);oracle(q[0], q[1], q[2], q[3], q[4], q[5]);diffusion(q[0], q[1], q[2], q[3], q[4], q[5]);measure q[0] -> c[0];measure q[1] -> c[1];measure q[2] -> c[2];measure q[3] -> c[3];measure q[4] -> c[4];measure q[5] -> c[5];",
            "assemblerLanguage": "QASM3",
            "pythonFilePath": "",
            "pythonFileMetadata": ""
          }
        ],
        "name": "DeploymentName"
      };
      console.log(openqasmCode)
      const regex = /^qubit\[\d+\]\s+\w+;$/gm;
      const qubitMatches = openqasmCode.match(regex);
      console.log(qubitMatches)

      if (qubitMatches) {
        const qubitIndices = qubitMatches.map(m => parseInt(m.match(/\d+/)[0], 10));
        console.log(qubitIndices)
        const maxQubitIndex = Math.max(...qubitIndices);

        // Example: trigger warning if any qubit index >= 30
        if (maxQubitIndex >= 30) {
          setWarningExecution(true);
          console.warn(`⚠️ Warning: High qubit index detected (${maxQubitIndex})`);
        }
      }
      let response = await fetch(qunicornEndpoint + "/deployments/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(program),
      });

      let data = await response.json();
      console.log(data["id"]);
      setDeploymentId(data["id"]);
      setModalStep(2);
      //pollStatus(response["Location"]);
    } catch (error) {
      console.error("Error sending data:", error);
      setLoading(false);
    }
  };


  const handleCreateJob = async () => {
    setLoading(true);

    try {
      let program = {
        "name": "JobName",
        "providerName": provider,
        "deviceName": selectedDevice,
        "shots": numShots,
        "errorMitigation": "none",
        "cutToWidth": null,
        "token": accessToken,
        "type": "RUNNER",
        "deploymentId": deploymentId
      }

      let response = await fetch(qunicornEndpoint + "/jobs/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(program),
      });

      let data = await response.json();
      console.log(data);
      if (data["code"] === 500) {
        setErrorJobMessage(data["message"]);
      } else {
        setJobId(data["self"]);
        setModalStep(3);
      }
    } catch (error) {
      console.error("Error sending data:", error);
      setLoading(false);
    }
  };

  const handleJobExecute = async () => {
    setModalStep(3);
    setLoading(true);
    setProgress(0);
    setErrorMessage(null);

    try {

      const url = `${qunicornEndpoint}/${jobId.startsWith('/') ? jobId.slice(1) : jobId}`;

      let getdata = null;

      // Initial fetch
      let getresponse = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!getresponse.ok) {
        throw new Error(`Request failed with status ${getresponse.status}`);
      }

      getdata = await getresponse.json();
      setProgress(5);

      if (getdata.state === "ERROR") {
        setErrorMessage("Job encountered an error.");
        setLoading(false);
        setProgress(0);
        return;
      }

      let tries = 0;
      const maxTries = 20;

      while (getdata.state !== "FINISHED" && getdata.state !== "ERROR" && tries < maxTries) {
        tries++;

        await new Promise((r) => setTimeout(r, 10000));

        const response = await fetch(url, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        getdata = await response.json();

        if (getdata.state === "ERROR") {
          setErrorMessage("Job encountered an error.");
          setLoading(false);
          setProgress(0);
          return;
        }

        setProgress(Math.min(((tries / maxTries) * 100), 100));
      }

      if (getdata.state !== "FINISHED") {
        setErrorMessage("Job did not finish in time.");
        setLoading(false);
        setProgress(0);
        return;
      }
      setTimeout(() => {
        setProgress(50);
      }, 1000);
      setTimeout(() => {
        setProgress(100);
        setAlreadyExecuted(true);
        console.log(getdata.results[1])
        let counts = getdata.results[1].data;
        console.log(counts)
        const chartData = Object.entries(counts || {}).map(([key, value]) => ({
          register: parseInt(key, 16),
          value: Number(value) * 100,
        }));
        setChartData(chartData);
      }, 2000);
      //pollStatus(response["Location"]);
    } catch (error) {
      console.error("Error sending data:", error);
      setLoading(false);
    }
  };

  const pollStatus = async () => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(lowcodeBackendEndpoint + "/status");
        const result = await response.json();
        setStatus(result);

        if (result.status === "complete") {
          clearInterval(interval);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error polling status:", error);
        clearInterval(interval);
        setLoading(false);
      }
    }, 3000);
  };


  const onNodeDragStop = useCallback(
    /**
     * 
     * @param evt {
        id: (nds.length + 1).toString(),
        type: "custom",
        position: { x: Math.random() * 100, y: Math.random() * 100 }, // Random position inside the parent
        data: { label: `Child ${nds.length}` },
        parentNode: parentId, // Link it to the parent
        extent: "parent", // Keeps child within parent bounds
      },
     * @param node 
     * @returns 
     */
    (evt, node) => {
      setHelperLines(null);
      if (node.type === "group") {
        return;
      }
      console.log("onNodeDrag");
      console.log(node);
      let nodeT = nodes[0];
      nodes.forEach((nd) => {
        // Check if there's a group node in the array of nodes on the screen
        if ((nd.type === "controlStructureNode" || nd.type === "ifElseNode") && node.type !== "controlStructureNode" && node.type !== "ifElseNode") {
          //safety check to make sure there's a height and width
          console.log(node);
          console.log(nd.id);
          let intersectionNodes = reactFlowInstance.getIntersectingNodes(node).map((n) => n.id);
          console.log(intersectionNodes)

          // Check if the dragged node is inside the group
          if (intersectionNodes[0] == nd.id) {
            console.log(nd);
            const rec = { height: nd.height, width: nd.width, ...nd.position };

            //Check if dragged node isn't already a child to the group
            if (!node.parentNode) {

              console.log("update node")
              node.parentNode = nd.id;
              // node cannot be moved outside parent
              node.extent = "parent";
              node.expandParent = true;


              node.position = {
                x: node.positionAbsolute.x - nd.position.x,
                y: node.positionAbsolute.y - nd.position.y,
              };

              // Get the main node
              const mainNode = document.querySelector<HTMLDivElement>(
                'div.react-flow__node-controlStructureNode'
              );

              if (mainNode) {
                // Get the first child div (grand-parent where you set width)
                const firstChild = mainNode.querySelector<HTMLDivElement>(
                  'div.grand-parent'
                );

                console.log('Main node:', mainNode);
                console.log('First child (grand-parent):', firstChild);
                if (firstChild) {
                  console.log()

                  // Get the current minWidth from computed styles
                  const currentMinWidth = window.getComputedStyle(firstChild).minWidth;

                  // Get the current minWidth from computed styles
                  const currentHeight = window.getComputedStyle(firstChild).height;
                  // Parse it into a number
                  const currentMinWidthValue = parseFloat(currentMinWidth);
                  // Add 100 to it
                  const newMinWidth = currentMinWidthValue + 100;

                  // Parse it into a number
                  const currentHeightValue = parseFloat(currentHeight);
                  console.log(currentHeightValue);
                  console.log(node.height)

                  const newHeight = node.height + 200 > currentHeightValue ? currentHeightValue + 100 : currentHeightValue + 100;

                  // Set it back with "px"
                  firstChild.style.minWidth = `${newMinWidth}px`;
                  firstChild.style.height = `${newHeight}px`;
                  console.log(`Updated minWidth to ${newMinWidth}px`);
                }
              } else {
                console.error('Main node not found');
              }


              //nd.style.width = 10;
              console.log(node);
              //intersectionNodes[0].width = 1000;
              nodeT = node;
              updateParent(node.id, nd.id, node.position);
              updateChildren(node.parentNode, node.id);
              //updateNodeValue(node.id, "hidden", "true")
              updateNodeValue(node.id, "position", node.position);
              updateNodeValue(node.id, "scope", "if");
            }
          }
        }
      });
      //setNodes(nodeT);
      if (node.id == contextMenu.nodeId) {
        console.log("moving context menu for node", node.id)
        setContextMenu((prev) => ({ ...prev, left: evt.clientX, top: evt.clientY }));
      }
    }, [nodes, setContextMenu]);


  const onDrop = React.useCallback(
    (event: any) => {
      console.log("dropped")
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
      const label = event.dataTransfer.getData("application/reactflow/label");
      console.log(position);
      if (label == qaoa) {
        loadFlow(qaoa_algorithm)
      } else if (label == swap_test) {
        loadFlow(swap_test_algorithm);
      }
      else if (label == hadamard_test_imaginary_part) {
        loadFlow(hadamard_test_imaginary_part_algorithm);
      }
      else if (label == hadamard_test_real_part) {
        loadFlow(hadamard_test_real_part_algorithm);
      }
      else if (label == grover) {
        loadFlow(grover_algorithm);
      }
      else if (label.startsWith(custom_template)) {
        const userTemplateFlowData = JSON.parse(event.dataTransfer.getData("application/reactflow/templateFlowData"));
        console.log("USER TEMPLATE")
        console.log(userTemplateFlowData)
        if (userTemplateFlowData) {
          loadFlow(userTemplateFlowData);
        }
        else {
          console.error(`User Template ${label} not found.`)
        }
      }
      else {
        handleOnDrop(event, reactFlowWrapper, reactFlowInstance, setNodes);
      }

      //setContextMenu((prev) => ({ ...prev, left: event.clientX, top: event.clientY,}));
    },
    [reactFlowInstance, setNodes],
  );

  const onNodesDelete = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, visible: false })); // contextMenu disappears when node is deleted
  }, [setContextMenu]);


  const flowKey = "example-flow";

  async function uploadToGitHub() {

    let flowId = `model-${Date.now()}`;
    const repoOwner = githubRepositoryOwner;
    const repo = githubRepositoryName;
    const branch = githubBranch;
    const token = githubToken;

    const apiUrl = `https://api.github.com/repos/${repoOwner}/${repo}/contents/${flowId}`;
    let sha = null;

    try {
      const getResponse = await fetch(`${apiUrl}?ref=${branch}`, {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      if (getResponse.ok) {
        const existingFile = await getResponse.json();
        sha = existingFile.sha;
        console.log("File exists, will update.");
      } else if (getResponse.status === 404) {
        console.log("File does not exist, will create new file.");
      } else {
        const errorData = await getResponse.json();
        console.error("Failed to check file existence:", errorData);
        return { success: false };
      }
    } catch (error) {
      console.error("Error checking file existence:", error);
      showToast("Upload failed. Credentials or repository fields incorrect.", "error");
      return { success: false };
    }

    console.log(containsPlaceholder)

    let fileContent = JSON.stringify({
      metadata: {
        ...metadata,
        containsPlaceholder: containsPlaceholder,
        id: flowId,
        timestamp: new Date().toISOString(),
      },
      flow: reactFlowInstance.toObject(),
    }, null, 2);

    const payload: any = {
      message: `Upload ${flowId} from quantum low-code modeler`,
      content: btoa(fileContent),
      branch: branch,
    };

    if (sha) {
      payload.sha = sha;
    }

    try {
      const uploadResponse = await fetch(`${apiUrl}?ref=${branch}`, {
        method: "PUT",
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (uploadResponse.ok) {
        console.log(`File ${flowId} uploaded to GitHub successfully.`);
        showToast("Model with id " + flowId + " uploaded successfully!", "success");
        return { success: true };
      } else {
        const errorData = await uploadResponse.json();
        showToast("Upload failed. Check console.", "error");
        console.error("GitHub upload failed:", errorData);
        return { success: false };
      }
    } catch (error) {
      console.error("Error uploading to GitHub:", error);
      return { success: false };
    }
  }

  async function registerAndUploadToGitHub(patternId, patternName, overwriteImplementationId, solutionId) {
    const flowId = `flow-${Date.now()}`;
    const modelFileName = `${flowId}.json`;
    const sqlPath = 'example-data/SQL/backup-files/2_pattern_solutions.sql';
    const modelPath = 'example-data/models';


    // 1. Prepare Model Content
    const modelContent = JSON.stringify({
      metadata: {
        ...metadata,
        containsPlaceholder: containsPlaceholder,
        id: flowId,
        timestamp: new Date().toISOString(),
      },
      flow: reactFlowInstance.toObject(),
    }, null, 2);

    // 2. Generate SQL for registration

    const ids = {
      algo: crypto.randomUUID(),
      fileId: crypto.randomUUID(),
      fileImplementationId: crypto.randomUUID(),
      filePackageId: crypto.randomUUID(),
      data: crypto.randomUUID(),
      package: crypto.randomUUID(),
    };

    const toHex = (str: string) => {
      const encoder = new TextEncoder();         // Encode string to bytes
      const bytes = encoder.encode(str);
      return '\\x' + Array.from(bytes)           // Convert each byte to hex
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    };

    console.log(toHex(ids.algo));


    const sqlAppend = `
-- Register ${modelFileName}
INSERT INTO public.knowledge_artifact (id, creation_date, last_modified_at) VALUES ('${ids.algo}', NULL, NULL);
INSERT INTO public.knowledge_artifact (id, creation_date, last_modified_at) VALUES ('${ids.package}', NULL, NULL);
INSERT INTO public.knowledge_artifact (id, creation_date, last_modified_at) VALUES ('${ids.fileId}', NULL, NULL);
INSERT INTO public.algorithm (acronym, algo_parameter, assumptions, computation_model, input_format, intent, name, output_format, problem, solution, id) VALUES (NULL, NULL, NULL, NULL, NULL, NULL, 'QML Implementation', NULL, NULL, NULL, '${ids.algo}');
INSERT INTO public.quantum_algorithm (nisq_ready, quantum_computation_model, speed_up, id) VALUES (false, 0, NULL, '${ids.algo}');
INSERT INTO public.quantum_algorithm (nisq_ready, quantum_computation_model, id) VALUES (false, 0, '${ids.algo}');
INSERT INTO public.implementation (assumptions, contributors, dependencies, description, input_format, license, link, name, technology, output_format, parameter, problem_statement, version, id, implemented_algorithm_id) VALUES (NULL, NULL, NULL, NULL, NULL, NULL, NULL, '${patternName} low-code solution', NULL, NULL, NULL, NULL, NULL, '${ids.package}', '${ids.algo}');
INSERT INTO public.pattern_uris (implementation_id, pattern_uri) VALUES ('${ids.package}', 'patternLanguages/af7780d5-1f97-4536-8da7-4194b093ab1d/patterns/${patternId}');
INSERT INTO public.file (fileurl, mime_type, name, id) VALUES ('${modelFileName}', 'application/json', '${modelFileName}', '${ids.fileId}');
INSERT INTO public.file_data (id, data, file_id) VALUES ('${ids.data}', '${toHex(modelContent)}', '${ids.fileId}');
INSERT INTO public.implementation_package (dtype, id, description, name, package_type, implementation_id, type) VALUES ('FileImplementationPackage', '${ids.fileImplementationId}', '${patternName} solution', 'Pattern low_code_modeler package', 0, '${ids.package}', 'low_code_modeler');
INSERT INTO public.implementation_package_file (file_id, implementation_package_id) VALUES ('${ids.fileId}', '${ids.fileImplementationId}');

`;

    const headers = {
      Authorization: `token ${githubToken}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    };

    try {
      // 3. Update SQL Seed File via API
      const sqlUrl = `https://api.github.com/repos/${githubRepositoryOwner}/${githubRepositoryName}/contents/${sqlPath}`;
      const sqlGet = await fetch(`${sqlUrl}?ref=${githubBranch}`, { headers });

      if (sqlGet.ok) {
        const { content, sha } = await sqlGet.json();
        const updatedSql = atob(content) + sqlAppend;

        await fetch(sqlUrl, {
          method: "PUT",
          headers,
          body: JSON.stringify({
            message: `Register ${modelFileName} in seed data`,
            content: btoa(updatedSql),
            sha,
            branch: githubBranch
          }),
        });
      }

      // 4. Upload the Model JSON File
      const modelUrl = `https://api.github.com/repos/${githubRepositoryOwner}/${githubRepositoryName}/contents/${modelPath}/${modelFileName}`;
      const modelUpload = await fetch(modelUrl, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          message: `Upload model ${flowId}`,
          content: btoa(modelContent),
          branch: githubBranch
        }),
      });

      if (modelUpload.ok) {
        console.log("Database registration and model upload successful.");
        return { success: true, flowId };
      }
    } catch (error) {
      console.error("GitHub API Error:", error);
      return { success: false };
    }
  }

  async function registerAndUploadToGitHub2(patternId: string, patternName: string, overwriteImplementationId, solutionId) {
    const flowId = `flow-${Date.now()}`;
    const modelFileName = `${flowId}.json`;
    const sqlPath = 'example-data/SQL/backup-files/2_pattern_solutions.sql';
    const modelPath = 'example-data/models';

    console.log(overwriteImplementationId);
    console.log(solutionId)
    const headers = {
      Authorization: `token ${githubToken}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    };

    // ------------------------
    // Generate model content
    // ------------------------
    const modelContent = JSON.stringify({
      metadata: {
        ...metadata,
        id: flowId,
        timestamp: new Date().toISOString(),
      },
      ...reactFlowInstance.toObject(),
    }, null, 2);

    const toHex = (str: string) => {
      const encoder = new TextEncoder();
      const bytes = encoder.encode(str);
      return '\\x' + Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    };

    const hexData = toHex(modelContent);

    try {
      // ------------------------
      // 1. Fetch SQL file
      // ------------------------
      const sqlUrl = `https://api.github.com/repos/${githubRepositoryOwner}/${githubRepositoryName}/contents/${sqlPath}`;
      const sqlGet = await fetch(`${sqlUrl}?ref=${githubBranch}`, { headers });

      if (!sqlGet.ok) throw new Error("Failed to fetch SQL file");

      const { content, sha } = await sqlGet.json();
      let sqlContent = atob(content);

      // ------------------------
      // 2. Check if implementation already exists
      // ------------------------
      const packageFileRegex = new RegExp(
        `INSERT INTO public\\.implementation_package_file\\s*\\([^)]*\\)\\s*VALUES\\s*\\('([^']+)'\\s*,\\s*'([^']+)'\\);`,
        'g'
      );



      console.log(solutionId);
      console.log(overwriteImplementationId)

      const match = [...sqlContent.matchAll(packageFileRegex)]
        .find(m => m[2] === solutionId);

      console.log(match)

      if (match) {
        // =========================================
        // UPDATE EXISTING ENTRY
        // =========================================

        const fileId = match[1];

        // Replace file_data hex
        const fileDataRegex = new RegExp(
          `INSERT INTO public\\.file_data \\(id, data, file_id\\) VALUES \\('([^']+)', '\\\\x[0-9a-f]*', '${fileId}'\\);`
        );

        sqlContent = sqlContent.replace(
          fileDataRegex,
          (full, dataId) =>
            `INSERT INTO public.file_data (id, data, file_id) VALUES ('${dataId}', '${hexData}', '${fileId}');`
        );

        console.log("Existing implementation updated.");
        showToast("Update existing implementation for "+ patternName, "success");
    } else {
        // =========================================
        // CREATE NEW ENTRY
        // =========================================

        const ids = {
          algo: crypto.randomUUID(),
          fileId: crypto.randomUUID(),
          fileImplementationId: crypto.randomUUID(),
          data: crypto.randomUUID(),
          package: crypto.randomUUID(),
        };

        const sqlAppend = `
-- Register ${modelFileName}
INSERT INTO public.knowledge_artifact (id, creation_date, last_modified_at) VALUES ('${ids.algo}', NULL, NULL);
INSERT INTO public.knowledge_artifact (id, creation_date, last_modified_at) VALUES ('${ids.package}', NULL, NULL);
INSERT INTO public.knowledge_artifact (id, creation_date, last_modified_at) VALUES ('${ids.fileId}', NULL, NULL);
INSERT INTO public.algorithm (name, id) VALUES ('QML Implementation', '${ids.algo}');
INSERT INTO public.quantum_algorithm (nisq_ready, quantum_computation_model, id) VALUES (false, 0, '${ids.algo}');
INSERT INTO public.implementation (name, id, implemented_algorithm_id) VALUES ('${patternName} low-code solution', '${ids.package}', '${ids.algo}');
INSERT INTO public.pattern_uris (implementation_id, pattern_uri) VALUES ('${ids.package}', 'pattern-languages/${patternId}');
INSERT INTO public.file (fileurl, mime_type, name, id) VALUES ('${modelFileName}', 'application/json', '${modelFileName}', '${ids.fileId}');
INSERT INTO public.file_data (id, data, file_id) VALUES ('${ids.data}', '${hexData}', '${ids.fileId}');
INSERT INTO public.implementation_package (dtype, id, description, name, package_type, implementation_id, type)
VALUES ('FileImplementationPackage', '${ids.fileImplementationId}', '${patternName} solution', 'Pattern low_code_modeler package', 0, '${ids.package}', 'low_code_modeler');
INSERT INTO public.implementation_package_file (file_id, implementation_package_id)
VALUES ('${ids.fileId}', '${ids.fileImplementationId}');
`;

        sqlContent += sqlAppend;
        console.log("New implementation inserted.");
        showToast("Upload new implementation for "+ patternName, "success");
      }

      // ------------------------
      // 3. Upload updated SQL
      // ------------------------
      await fetch(sqlUrl, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          message: `Register or update ${modelFileName}`,
          content: btoa(sqlContent),
          sha,
          branch: githubBranch
        }),
      });

      // ------------------------
      // 4. Upload model JSON
      // ------------------------
      const modelUrl = `https://api.github.com/repos/${githubRepositoryOwner}/${githubRepositoryName}/contents/${modelPath}/${modelFileName}`;

      await fetch(modelUrl, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          message: `Upload model ${flowId}`,
          content: btoa(modelContent),
          branch: githubBranch
        }),
      });

      console.log("SQL + Model upload successful.");
      return { success: true, flowId };

    } catch (error) {
      console.error("GitHub API Error:", error);
       showToast("Upload of implementation for "+ patternName +" failed.", "error");
      return { success: false };
    }
  }


  async function handleSaveClick() {
    if (!reactFlowInstance) {
      console.error("React Flow instance is not initialized.");
      return;
    }
    console.log("davor");
    const flow = reactFlowInstance.toObject();
    console.log(flow);
    const validMetadata = {
      ...metadata,
      containsPlaceholder: containsPlaceholder,
      id: `flow-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };

    console.log(validMetadata);
    console.log(metadata);

    const flowWithMetadata = { metadata: validMetadata, ...flow };

    const event = new CustomEvent("lcm-save", {
      cancelable: true,
      detail: flowWithMetadata,
    });
    const defaultAction = document.dispatchEvent(event);
    console.log(`defaultAction: ${defaultAction}`);
    if (!defaultAction)
      return;

    // Create a downloadable JSON file
    const jsonBlob = new Blob([JSON.stringify(flowWithMetadata, null, 2)], {
      type: "application/json",
    });
    const jsonString = JSON.stringify(flowWithMetadata, null, 2);
    const downloadUrl = URL.createObjectURL(jsonBlob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `${(validMetadata?.name ?? "metadata").replace(/\s+/g, "_")}_${validMetadata?.id ?? "unknown"}.json`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
    console.log("Flow saved:", flowWithMetadata);
  }




  const handleSaveAsTemplate = () => {
    console.log("Saving User Template")
    if (!reactFlowInstance) {
      console.error("React Flow instance is not initialized.");
      return;
      // TODO: toast error message
    }
    let templateFlow = reactFlowInstance.toObject();
    console.log(templateFlow)
    // add metadata to templateFlow
    templateFlow = {
      ...templateFlow,
      metadata: metadata,
    }
    const date = Date.now();
    const timestamp = new Date().toISOString();
    const newTemplate: Template = {
      label: `${custom_template}-${date}`,
      type: templates,
      icon: "QAOA.png", //TODO
      description: metadata.description,
      completionGuaranteed: true,
      compactOptions: [true, false],
      id: `flow-${date}`,
      timestamp: timestamp,
      name: metadata.name, // get name from meta data
      flowData: templateFlow
    }
    console.log(newTemplate)
    // save metadata to userTemplates
    addUserTemplate(newTemplate);
  };


  function handleRestoreClick() {
    if (!reactFlowInstance) {
      console.error("React Flow instance is not initialized.");
      return;
    }

    function restoreFlow(flow) {
      console.log("Restoring flow:", flow);
      if (flow.nodes) {
        reactFlowInstance.setNodes(
          flow.nodes.map((node: Node) => ({
            ...node,
            data: {
              ...node.data,
            },
          }))
        );
        console.log("Nodes restored.");
      }
      if (flow.edges) {
        reactFlowInstance.setEdges(flow.edges || []);
        console.log("Edges restored.");
      }


      const { x = 0, y = 0, zoom = 1 } = flow.viewport || {};
      reactFlowInstance.setViewport({ x, y, zoom });

      if (flow.metadata) {
        setMetadata(flow.metadata);
        console.log("Metadata restored:", flow.metadata);
      }
    }

    const event = new CustomEvent("lcm-open", {
      cancelable: true,
      detail: {
        restoreFlow
      },
    });
    const defaultAction = document.dispatchEvent(event);
    console.log(`defaultAction: ${defaultAction}`);
    if (!defaultAction)
      return;

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "application/json";

    fileInput.onchange = (event) => {
      const file = (event.target as HTMLInputElement)?.files?.[0];
      if (!file) {
        console.warn("No file selected.");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const flow = JSON.parse(e.target?.result as string);

          restoreFlow(flow);
        } catch (error) {
          console.error("Error parsing JSON file:", error);
          alert("Invalid JSON file. Please ensure it is a valid flow file.");
        }
      };

      reader.onerror = (err) => {
        console.error("Error reading file:", err);
        alert("Failed to read file. Please try again.");
      };

      reader.readAsText(file);
    };

    fileInput.click();
  }

  useKeyBindings({ undo, redo });

  const handleClick = React.useCallback(
    (event: React.MouseEvent, node: Node) => {
      // Prevent the default action (if any)
      event.preventDefault();

      // Set the selected node
      setSelectedNode(node);

    },
    [setSelectedNode],
  );

  const [modeledDiagram, setModeledDiagram] = useState(null);

  // Function to load the flow
  const overwriteFlow = (flow: any) => {
    if (!reactFlowInstance) {
      console.error("React Flow instance is not initialized.");
      return;
    }
    console.log(flow.initialEdges)
    console.log(flow.nodes)
    if (flow.nodes) {
      reactFlowInstance.setNodes(
        flow.nodes?.map((node: Node) => ({
          ...node,
          data: {
            ...node.data,
          },
        }))
      );
    }
    if (flow.initialEdges) {
      reactFlowInstance.setEdges(flow.initialEdges);
      console.log("Edges loaded.");
    } else if (flow.edges) {
      reactFlowInstance.setEdges(flow.edges);
      console.log("Edges loaded.");
    }
    console.log("load flow nodes", nodes);
    console.log(edges);

    // Reset the viewport (optional based on your use case)
    const { x = 0, y = 0, zoom = 1 } = flow.viewport || {};
    reactFlowInstance.setViewport({ x, y, zoom });

    console.log(flow.metadata)
    // Set the metadata (if any) - assuming initialDiagram has metadata
    if (flow.metadata) {
      // If metadata is an array, unpack it
      const dataToSet = Array.isArray(flow.metadata) ? flow.metadata[0] : flow.metadata;
      setMetadata(dataToSet);
      console.log("Metadata loaded:", dataToSet);
    }

  };

  // Function to load the flow in addition to all nodes and edges already on the canvas
  const loadFlow = (flow: any) => {
    if (!reactFlowInstance) {
      console.error("React Flow instance is not initialized.");
      return;
    }
    console.log(flow.initialEdges)
    console.log(flow.nodes)
    if (flow.nodes) {
      reactFlowInstance.setNodes(
        flow.nodes?.map((node: Node) => ({
          ...node,
          data: {
            ...node.data,
          },
        }))
      );
    }
    if (flow.initialEdges) {
      reactFlowInstance.setEdges(flow.initialEdges);
      console.log("Edges loaded.");
    } else if (flow.edges) {
      reactFlowInstance.setEdges(flow.edges);
      console.log("Edges loaded.");
    }
    console.log("load flow nodes", nodes);
    console.log(edges);

    // Reset the viewport (optional based on your use case)
    const { x = 0, y = 0, zoom = 1 } = flow.viewport || {};
    reactFlowInstance.setViewport({ x, y, zoom });

    console.log(flow.metadata)
    // Set the metadata (if any) - assuming initialDiagram has metadata
    if (flow.metadata) {
      // If metadata is an array, unpack it
      const dataToSet = Array.isArray(flow.metadata) ? flow.metadata[0] : flow.metadata;
      setMetadata(dataToSet);
      console.log("Metadata loaded:", dataToSet);
    }

  };

  const onNodeDrag = React.useCallback((event: React.MouseEvent, node: Node, nodes: Node[]) => {
    console.log(reactFlowInstance.getNodes())
    const currentNodes = reactFlowInstance.getNodes();
    console.log(node.position.x);
    console.log(helperLines)
    console.log(event.clientX)

    let verticalLine = null;
    let horizontalLine = null;

    console.log(verticalLine);
    console.log(horizontalLine)
    const bounds = getNodesBounds(currentNodes);
    console.log(bounds);
    const { x, y, zoom } = reactFlowInstance.getViewport();
    console.log(x);
    console.log(y);
    const snapThreshold = 0; // Adjust threshold for snapping
    console.log(ref.current?.getBoundingClientRect())
    const boundingRect = ref.current?.getBoundingClientRect()
    const cneter = reactFlowInstance.screenToFlowPosition({
      x: boundingRect.x + boundingRect.width,
      y: boundingRect.y + boundingRect.height
    })
    console.log(cneter)
    const screenY = reactFlowInstance.flowToScreenPosition({ x: node.position.x, y: node.position.y });
    console.log(screenY);
    console.log(reactFlowInstance.getZoom())

    // Find closest nodes for alignment
    currentNodes.forEach((otherNode) => {
      if (otherNode.id === node.id) return;

      // Check for horizontal alignment
      if (Math.abs(node.position.y - otherNode.position.y) === snapThreshold) {
        console.log("horizontalLine")
        const screen = reactFlowInstance.flowToScreenPosition({ x: node.position.x, y: node.position.y });
        console.log(screen);
        horizontalLine = screen.y - 70;
      }
    });

    // Only update helperLines if there's alignment
    if (verticalLine !== null) {
      setHelperLines({
        x: verticalLine,
        y: null
      });
    }
    if (horizontalLine !== null) {

      setHelperLines({
        x: null,
        y: horizontalLine
      });
    }
    if (horizontalLine === null && verticalLine === null) {

      setHelperLines({
        x: null,
        y: null
      });
    }
    console.log(helperLines)
    console.log(node.position.x)


    //findGuidelines(node);
    console.log(reactFlowInstance)
    const intersections = reactFlowInstance.getIntersectingNodes(node).map((n) => n.id);
    console.log(intersections)
    //updateNodeValue(node.id, "parentNode", intersections)
    console.log("trest")
    console.log(intersections)
    console.log(nodes);
    let oldPosition = node.position;
    currentNodes.forEach((nd) => {
      console.log("check")
      console.log(nd.id);
      console.log(node.id);
      console.log(node.parentNode)
      if (node.parentNode && nd.id !== node.id) {
        console.log("parent nicht nzkk")
        const relativeX = node.positionAbsolute.x - nd.position.x;
        const relativeY = node.positionAbsolute.y - nd.position.y;
        console.warn("Hier drin")

        const isForbidden = node.data?.scope === "if" && relativeY > nd.height / 2;

        if (isForbidden) {
          const maxY = relativeY > nd.height / 2;

          console.warn("Cannot drop node in the right half due to 'if' constraint.");
          return;

        }
      }
    })
    // move contextmenu with dragged node if it belongs to that node
    // if other node is dragged: make context menu invisible
    if (node.id == contextMenu.nodeId) {
      console.log("drag contextmenu to nodeid: ", node.id)
      setContextMenu((prev) => ({ ...prev, top: event.clientY, left: event.clientX }))
    } else {
      setContextMenu((prev) => ({ ...prev, visible: false }))
    }
  }
    , [reactFlowInstance, helperLines, nodes, setContextMenu]);

  const onPaneClick = useCallback(() => {
    setMenu(null);
    setContextMenu((prev) => ({ ...prev, visible: false })); // contextMenu disappears when clicking on pane
    setSelectedNode(null);
    console.log("reset");
  }, [setMenu, setContextMenu, setSelectedNode]);

  const onClick = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, visible: false })); // contextMenu disappears when clicking anywhere in canvas (but not other panels)
  }, [setContextMenu]);

  const handleOpenConfig = () => setIsConfigOpen(true);
  const handleManageTemplates = () => setIsManageTemplatesOpen(true);

  const onExperienceLevelChange = (event) => {
    setExperienceLevel(event);
    setExperienceLevelOn(event);
    const bool_value = (experienceLevel === "pioneer") ? false : true; // if previous experience level was pioneer...
    setCompactVisualization(bool_value)
    setAncillaMode(bool_value)
    setAncillaModelingOn(bool_value)
    //updateNodeInternals since ancilla mode changes number of handles
    nodes.forEach((node) => {
      updateNodeInternals(node.id);
    })
  };



  const onToggleAncilla = () => {
    setAncillaModelingOn(!ancillaModelingOn);
    setAncillaMode(!ancillaModelingOn);
    //updateNodeInternals since ancilla mode changes number of handles
    nodes.forEach((node) => {
      updateNodeInternals(node.id);
    })
  }

  const handleSaveAsSVG = () => {
    if (ref.current === null) {
      console.error("React Flow container reference is null.");
      return;
    }

    toSvg(ref.current, {
      filter: (node) => {
        if (!node) return false;
        if (node.classList?.contains("react-flow__minimap")) return false;
        if (node.classList?.contains("react-flow__controls")) return false;
        if (node.classList?.contains("react-flow__panel")) return false;
        if (typeof node.className === "string" && node.className.includes("react-flow__panel")) return false;

        return true;
      }
    })
      .then((dataUrl) => {
        const a = document.createElement("a");
        a.setAttribute("download", "reactflow-diagram.svg"); // TODO: Dateiname ändern?
        a.setAttribute("href", dataUrl);
        a.click();
      })
      .catch((err) => console.error("Error exporting SVG:", err));
  };

  async function deployWorkflowToCamunda(
    workflowName,
    workflowXml,
    viewMap
  ) {
    console.log(
      "Deploying workflow to Camunda Engine"
    );

    // add required form data fields
    const form = new FormData();
    form.append("deployment-name", workflowName);
    form.append("deployment-source", "QuantME Modeler");
    form.append("deploy-changed-only", "false");

    // add bpmn file ending if not present
    let fileName = workflowName;
    if (!fileName.endsWith(".bpmn")) {
      fileName = fileName + ".bpmn";
    }
    console.log(workflowXml)

    // add diagram to the body
    const bpmnFile = new File([workflowXml], fileName, { type: "text/xml" });
    form.append("data", bpmnFile);

    // make the request and wait for the response of the deployment endpoint
    try {
      console.log(
        "Deploying to Camunda Engine: "
      );
      const response = await fetch(
        camundaEndpoint + "/deployment/create",
        {
          method: "POST",
          body: form,
        }
      );
      showToast("Deployment of workflow started ", "info");

      if (response.ok) {
        // retrieve deployment results from response
        const result = await response.json();
        console.info("Deployment provides result: ", result);
        console.info(
          "Deployment successful with deployment id: %s",
          result["id"]
        );
        console.log(result["deployedProcessDefinitions"]);

        // abort if there is not exactly one deployed process definition
        if (
          Object.values(result["deployedProcessDefinitions"] || {}).length !== 1
        ) {
          console.error(
            "Invalid size of deployed process definitions list: " +
            Object.values(result["deployedProcessDefinitions"] || {}).length
          );
          return { status: "failed" };
        }
        showToast("Workflow is deployed ", "success");
        return {
          status: "deployed",
          deployedProcessDefinition: Object.values(
            result["deployedProcessDefinitions"] || {}
          )[0],
        };
      } else {
        console.error(
          "Deployment of workflow returned invalid status code: %s",
          response.status
        );

        return {
          status: "failed",
          message:
            "Deployment of workflow returned invalid response: " + response,
        };
      }
    } catch (error) {
      console.error("Error while executing post to deploy workflow: " + error);
      showToast("Error while executing post to deploy workflow: ", "error");
      return {
        status: "failed",
        message: "Error while executing post to deploy workflow: " + error,
      };
    }
  }

  /**
   * Uploads a QRMS ZIP file to GitHub, updating files if they already exist.
   */
  async function uploadQRMS(qrmsUrl: string, modelId: string): Promise<void> {
    const token = githubToken;
    if (!token) throw new Error("Missing GitHub token");
    const owner = githubRepositoryOwner;
    const repo = githubRepositoryName;
    const basePath = `qrms_uploads/${modelId}`;

    const res = await fetch(qrmsUrl);
    if (!res.ok) throw new Error("Failed to fetch QRMS zip");
    const baseUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${basePath}`;

    const folderCheck = await fetch(baseUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (folderCheck.ok) {
      console.log(`Folder ${basePath} already exists — skipping upload.`);
      return; // exit early — skip re-upload
    }
    const buf = await res.arrayBuffer();
    const zip = await JSZip.loadAsync(buf);

    for (const [relative, file] of Object.entries(zip.files)) {
      if (file.dir) continue;
      const content = await file.async("string");
      const encoded = btoa(unescape(encodeURIComponent(content)));
      const githubPath = `${basePath}/${relative}`;
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${githubPath}`;

      // look up sha if file already exists
      let sha: string | undefined;
      const head = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (head.ok) {
        const data = await head.json();
        sha = data.sha;
      }

      // create or update file
      const put = await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: sha
            ? `Update existing QRMS file: ${relative}`
            : `Upload new QRMS file: ${relative}`,
          content: encoded,
          sha,
        }),
      });

      if (!put.ok) {
        const txt = await put.text();
        throw new Error(`Failed to upload ${relative}: ${txt}`);
      }
      console.log("QRMs uploaded", githubPath);
    }
  }

  /**
   * Configuration for the new pattern solution entry
   */
  const NEW_FILE_NAME = 'new-workflow.json';
  const NEW_FILE_CONTENT = {
    metadata: { version: "1.0.0", name: "New Workflow" },
    nodes: [],
    edges: []
  };
  const PACKAGE_TYPE = 'workflow_editor';
  const ALGO_NAME = 'New Algorithm Entry';
  const IMPL_NAME = 'New Implementation Entry';

  /**
   * Helper to convert JSON to Postgres Hex format (\x...)
   */
  const toHex = (obj: any) => '\\x' + Buffer.from(JSON.stringify(obj)).toString('hex');

  function generateAppendSql() {
    const ka_algo_id = uuidv4();
    const ka_impl_id = uuidv4();
    const ka_file_id = uuidv4();
    const ka_pkg_id = uuidv4();
    const file_data_id = uuidv4();
    let fileContent = JSON.stringify({
      metadata: {
        ...metadata,
        containsPlaceholder: containsPlaceholder,
        id: "flow123",
        timestamp: new Date().toISOString(),
      },
      flow: reactFlowInstance.toObject(),
    }, null, 2);

    return `

-- Additional manual registration for ${NEW_FILE_NAME}
INSERT INTO public.knowledge_artifact (id) VALUES ('${ka_algo_id}');
INSERT INTO public.knowledge_artifact (id) VALUES ('${ka_impl_id}');
INSERT INTO public.knowledge_artifact (id) VALUES ('${ka_file_id}');
INSERT INTO public.knowledge_artifact (id) VALUES ('${ka_pkg_id}');

INSERT INTO public.algorithm (name, id) VALUES ('${ALGO_NAME}', '${ka_algo_id}');
INSERT INTO public.quantum_algorithm (nisq_ready, quantum_computation_model, id) VALUES (false, 0, '${ka_algo_id}');
INSERT INTO public.implementation (name, id, implemented_algorithm_id) VALUES ('${IMPL_NAME}', '${ka_impl_id}', '${ka_algo_id}');

INSERT INTO public.implementation_package (id, type) VALUES ('${ka_pkg_id}', '${PACKAGE_TYPE}');

INSERT INTO public.file (fileurl, mime_type, name, id) VALUES ('${NEW_FILE_NAME}', 'application/json', '${NEW_FILE_NAME}', '${ka_file_id}');
INSERT INTO public.file_data (id, data, file_id) VALUES ('${file_data_id}', '${toHex(fileContent)}', '${ka_file_id}');

INSERT INTO public.implementation_package_file (file_id, implementation_package_id) VALUES ('${ka_file_id}', '${ka_pkg_id}');
`;
  }


  async function createServiceTemplates(serviceDeploymentModelsUrl: string, namespace: string): Promise<void> {
    const res = await fetch(serviceDeploymentModelsUrl);
    if (!res.ok) throw new Error(`Failed to fetch service deployment models: ${res.statusText}`);

    // Load ZIP into JSZip
    const arrayBuffer = await res.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Extract folder names
    const folderNames = new Set<string>();

    for (const [path, entry] of Object.entries(zip.files)) {
      const match = path.match(/^(Activity_[^/]+)/);
      if (match) {
        folderNames.add(match[1]);
      }
    }

    console.log(`Found service deployment folders:`, Array.from(folderNames));


    const masterZip = await JSZip.loadAsync(arrayBuffer);
    // Process each folder 
    for (const [path, entry] of Object.entries(masterZip.files)) {
      if (entry.dir) continue;
      if (!path.endsWith(".zip")) continue;

      // Extract activity name
      const activityName = path.replace(".zip", "");
      console.log(`Processing activity ZIP: ${activityName}`);

      // Load the activity ZIP in memory
      const activityArrayBuffer = await entry.async("arraybuffer");
      const activityZip = await JSZip.loadAsync(activityArrayBuffer);

      // Find service.zip inside activity ZIP
      const serviceEntry = Object.values(activityZip.files).find(
        (f) => !f.dir && f.name.endsWith("service.zip")
      );

      if (!serviceEntry) {
        console.warn(`No service.zip found in ${activityName}`);
        continue;
      }

      // Extract service.zip as Blob
      const serviceArrayBuffer = await serviceEntry.async("arraybuffer");
      const serviceBlob = new Blob([serviceArrayBuffer], { type: "application/zip" });

      // Create deployment model
      const versionUrl = `http://localhost:8093/winery/servicetemplates/${activityName}`;
      await createDeploymentModel(
        serviceBlob,
        "http://localhost:8093/winery",
        `${activityName}_DA`,
        "http://opentosca.org/artifacttemplates",
        "{http://opentosca.org/artifacttypes}DockerContainerArtifact",
        "service.zip",
        versionUrl
      );
      const OPENTOSCA_NAMESPACE_NODETYPE = "http://opentosca.org/nodetypes";
      const QUANTME_NAMESPACE_PULL = "http://quantil.org/quantme/pull";

      // Create service template
      let serviceTemplate = await createServiceTemplate(activityName, namespace);
      await createNodeType(
        activityName + "Container",
        OPENTOSCA_NAMESPACE_NODETYPE
      );
      await updateNodeType(
        activityName + "Container",
        OPENTOSCA_NAMESPACE_NODETYPE
      );
      serviceTemplate = await updateServiceTemplate(
        activityName,
        QUANTME_NAMESPACE_PULL
      );
      console.log(`Service template created for: ${activityName}`);
    }

  }

  return (
    <>
      <Joyride
        steps={joyrideSteps}
        run={runTour}
        continuous
        showSkipButton
        showProgress
        styles={{
          options: {
            primaryColor: '#007bff',
            zIndex: 10000,
          },
        }}
        callback={(data) => {
          const { status, index, type } = data;
          console.log("HELP");
          console.log(index);
          console.log(type);
          if (type === 'step:before' && index === 0) {
            // open both side panels if they're not opened
            setIsPaletteOpen(true);
            setIsPanelOpen(true);
            //setExpanded(true);
          }
          if (type === 'step:before' && index === 1) {
            let fileContent = JSON.stringify(reactFlowInstance.toObject());
            setModeledDiagram(fileContent);
          }
          if (type === 'step:before' && index === 3) {
            startTour2();
            setExpanded(true);
          }
          if (type === 'step:before' && index === 4) {

            const id = "086a4f77-2562-44d3-b0df-7cfe83ae369a";
            const node = nodes.find(n => n.id === id);
            setSelectedNode(node);
            console.log("NODES", nodes);
            console.log("SELECTED NODE", node);
          }
          if (type === 'step:before' && index === 5) {
            setExpanded(false);
            const id = "e2a719bf-516c-4601-84d1-de643b05ea02";
            const node = nodes.find(n => n.id === id);
            setSelectedNode(node);
            console.log("NODES", nodes);
            console.log("SELECTED NODE", node);
          }
          if (type === 'step:before' && index === 6) {
            setExpanded(false);
            setSelectedNode(null);
          }
          if (type === 'step:after' && index === 7) {
            startTour3();

          }
          if (['finished', 'skipped'].includes(data.status)) {
            setRunTour(false);
            setExpanded(false);
            if (modeledDiagram) {
              overwriteFlow(JSON.parse(modeledDiagram));
            }
          }
        }}
      />

      <div className="toolbar-container">
        <Toolbar
          onSave={handleSaveClick}
          onRestore={handleRestoreClick}
          onSaveAsSVG={handleSaveAsSVG}
          onOpenConfig={handleOpenConfig}
          uploadDiagram={() => uploadToGitHub()}
          uploadPatternSolution={() => setIsPatternModalOpen(true)}
          openPatternSolution={() => setIsPatternImplementationOpen(true)}

          //uploadPatternSolution={() => registerAndUploadToGitHub()}
          onLoadJson={handleLoadJson}
          sendToBackend={handleOpenValidation}
          startQuantumAlgorithmSelection={startQuantumAlgorithmSelection}
          //sendToQunicorn={() => setIsQunicornOpen(true)}
          openHistory={openHistoryModal}
          startTour={() => { startTour(); }}
          onSaveAsTemplate={handleSaveAsTemplate}
          onManageTemplates={handleManageTemplates}
        />
      </div>
      {<NewDiagramModal open={isLoadJsonModalOpen} onClose={cancelLoadJson} onConfirm={confirmNewDiagram} />}

      <ValidationModal
        open={isValidationOpen}
        onClose={() => setIsValidationOpen(false)}
        onConfirm={() => {
          setIsValidationOpen(false);
          setModalOpen(true);
        }}
        validationResult={validationResult}
      />
    <SendRequestModal
      open={modalOpen}
      onClose={() => setModalOpen(false)}
      compilationTarget={compilationTarget}
      containsPlaceholder={containsPlaceholder}
      setCompilationTarget={setCompilationTarget}
      sendToBackend={sendToBackend}
      qasmCode={openqasmCode}
/>

      <ConfigModal
        open={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        onSave={handleSave}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        ancillaMode={ancillaModelingOn}
        compactVisualization={compactVisualization}
        completionGuaranteed={completionGuaranteed}
        experienceLevel={experienceLevel}
        tempCamundaEndpoint={camundaEndpoint}
        tempNisqAnalyzerEndpoint={nisqAnalyzerEndpoint}
        tempOpenAIToken={openAIToken}
        tempQunicornEndpoint={qunicornEndpoint}
        tempLowcodeBackendEndpoint={lowcodeBackendEndpoint}
        tempPatternAtlasUiEndpoint={patternAtlasUiEndpoint}
        tempPatternAtlasApiEndpoint={patternAtlasApiEndpoint}
        tempQcAtlasEndpoint={qcAtlasEndpoint}
        tempGithubRepositoryOwner={githubRepositoryOwner}
        tempGithubRepositoryName={githubRepositoryName}
        tempGithubBranch={githubBranch}
        tempGithubToken={githubToken}
      />

      <ManageTemplateModal
        open={isManageTemplatesOpen}
        onClose={() => setIsManageTemplatesOpen(false)}
        templates={userTemplates}
        onSave={handleManageTemplatesSave}
      />

      <QunicornModal
        open={isQunicornOpen}
        step={modalStep}
        executed={executed}
        onClose={handleClose}
        simulatorWarning={warningExecution}
        onStep1Deploy={handleDeploy}
        onStep2CreateJob={handleCreateJob}
        onStep3Execute={handleJobExecute}
        selectedDevice={selectedDevice}
        setSelectedDevice={setSelectedDevice}
        provider={provider}
        setProvider={setProvider}
        numShots={numShots}
        setNumShots={setNumShots}
        accessToken={accessToken}
        setAccessToken={setAccessToken}
        errorMessage={errorMessage}
        progress={progress}
        chartData={chartData}
      />

      {patternGraph && (
        <Modal
          title="Pattern Graph"
          open={true}
          onClose={() => setPatternGraph(null)}
        >
          <img src={patternGraph} alt="Pattern graph" className="w-full rounded" />
        </Modal>
      )}


      <AiModal
        quantumAlgorithmModalStep={quantumAlgorithmModalStep}
        quantumAlgorithms={quantumAlgorithms}
        isDetectingAlgorithms={isDetectingAlgorithms}
        detectQuantumAlgorithms={detectQuantumAlgorithms}
        handleQuantumAlgorithmModalClose={handleQuantumAlgorithmModalClose}
        setQuantumAlgorithmModalStep={setQuantumAlgorithmModalStep}
        loadFlow={overwriteFlow}
      />

      <HistoryModal
        open={isHistoryOpen}
        onClose={() => setHistoryOpen(false)}
        history={history}
        onExecute={async (item) => {
          console.log(item);
          setHistoryOpen(false);

          try {
            // Fetch the model JSON from the request link to check compilation_target
            const requestResponse = await fetch(item.links.request);
            if (!requestResponse.ok) throw new Error("Failed to fetch model file");
            const modelData = await requestResponse.json();

            const compilationTarget = modelData?.compilation_target;

            // If the model is a workflow
            if (compilationTarget === "workflow") {
              //store the workflow data in your state
              setWorkflow(modelData);
              const resultResponse = await fetch(item.links.result);
              const qasmText = await resultResponse.text();
              await deployWorkflowToCamunda("process-workflow", qasmText, "");

              // Upload the QRMS file to GitHub if available
              if (item.links?.qrms) {
                try {
                  await uploadQRMS(item.links.qrms, item.uuid);
                } catch (err) {
                  console.error("QRMS upload failed:", err);
                }
              }

              if (item.links?.serviceDeploymentModels) {
                try {
                  const QUANTME_NAMESPACE_PULL = "http://quantil.org/quantme/pull";
                  await createServiceTemplates(item.links.serviceDeploymentModels, QUANTME_NAMESPACE_PULL);

                } catch (err) {
                  console.error("QRMS upload failed:", err);
                }
              }

              return;
            }

            setIsQunicornOpen(true);
            const resultResponse = await fetch(item.links.result);
            if (!resultResponse.ok) throw new Error("Failed to fetch QASM result");

            const qasmText = await resultResponse.text();
            setOpenQASMCode(qasmText);

          } catch (error) {
            console.error("Error handling execution:", error);
          }
        }}
      />


      <main className="flex flex-col lg:flex-row h-[calc(100vh_-_60px)]">
        <div className="relative flex h-[calc(100vh_-_60px)]  border-gray-200 border">
          <div
            className={`transition-all duration-300 ${isPaletteOpen ? "w-[300px] lg:w-[350px]" : "w-0 overflow-hidden"}`}
          >
            {isPaletteOpen && <Palette ancillaMode={ancillaModelingOn} />}
          </div>
          <button
            onClick={togglePalette}
            style={{
              width: "24px"
            }}
            className={`
    absolute top-1/2 transform -translate-y-1/2 
    bg-gray-400 text-white p-2 rounded-l-lg shadow-md hover:bg-gray-600 z-50 
    ${isPaletteOpen ? "right-0" : "hidden"} 
    ${isValidationOpen ? "hidden" : ""}
  `}
          >
            {isPaletteOpen ? "←" : "→"}
          </button>

          <button
            onClick={togglePalette}
            style={{
              width: "24px",
              paddingLeft: "4px"
            }}
            className={`absolute top-1/2 transform -translate-y-1/2 bg-gray-400 text-white p-2 rounded-r-lg shadow-md hover:bg-gray-600 z-50 ${isPaletteOpen ? "hidden" : "-left-0"} ${isValidationOpen ? "hidden" : ""}`}
          >
            {isPaletteOpen ? "←" : "→"}
          </button>

        </div>

        <div
          className="h-[calc(100vh_-_60px)] flex-grow"
          ref={reactFlowWrapper}
        >
          <ReactFlow
            ref={ref}
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeContextMenu={onNodeContextMenu}
            onNodeClick={(event: React.MouseEvent, node: Node) => {
              handleClick(event, node);
            }}
            onConnectEnd={onConnectEnd}
            onConnect={onConnect}
            onPaneClick={onPaneClick}
            onClick={onClick}
            onDragOver={onDragOver}
            onNodeDrag={onNodeDrag}
            onNodeDragStop={onNodeDragStop}
            onDrop={onDrop}
            onNodesDelete={onNodesDelete}
            onEdgesDelete={onEdgesDelete}

            fitView
            fitViewOptions={{ maxZoom: 1 }}
            onInit={setReactFlowInstance}
            snapToGrid={true}
            nodeTypes={nodesConfig.nodeTypes}
            edgeTypes={nodesConfig.edgesTypes}
          >{helperLines && (
            <>
              {helperLines.x !== null && (
                <div
                  style={{
                    position: "absolute",
                    left: helperLines.x,
                    top: 0,
                    height: "100%",
                    width: "1px",
                    background: "red",
                    pointerEvents: "none"
                  }}
                />
              )}
              {helperLines.y !== null && (
                <div
                  style={{
                    position: "absolute",
                    top: helperLines.y, //(ref.current?.scrollTop || 0),
                    left: 0,
                    width: "100%",
                    height: "1px",
                    background: "red",
                    pointerEvents: "none"
                  }}
                />
              )}
            </>
          )}
            <Controls />
            {toast && (
              <Toast
                message={toast.message}
                type={toast.type}
                onClose={() => setToast(null)}
              />
            )}

            {isPatternModalOpen && (
              <PatternSelectionModal
                onClose={() => setIsPatternModalOpen(false)}
                onConfirm={(patternId, patternName, overwriteImplementationId, solutionId) => {
                  setIsPatternModalOpen(false);
                  registerAndUploadToGitHub2(patternId, patternName, overwriteImplementationId, solutionId);
                }} open={isPatternModalOpen} />
            )}

            {isPatternImplementationOpen && (
              <PatternImplementationSelectionModal
                onClose={() => setIsPatternImplementationOpen(false)}
                onConfirm={(patternId, patternName, json) => {
                  setIsPatternImplementationOpen(false);
                  loadFlow(json)
                }} open={isPatternImplementationOpen} />
            )}



            <ExperienceModePanel
              expanded={expanded}
              onToggleExpanded={() => setExpanded(!expanded)}
              ancillaModelingOn={ancillaModelingOn}
              onToggleAncilla={onToggleAncilla}
              experienceLevel={experienceLevel}
              onExperienceLevelChange={onExperienceLevelChange}
              //onExperienceLevelChange={(event) => { setExperienceLevel(event); setExperienceLevelOn(event); }}
              compactVisualization={compactVisualization}
              onCompactVisualizationChange={() => { setCompactVisualization(!compact); setCompact(!compact) }}
              completionGuaranteed={completionGuaranteed}
              onCompletionGuaranteedChange={setCompletionGuaranteed}
            />

            <MiniMap
              nodeClassName={(node) => {
                if (node.type === 'dataTypeNode' || node.type === "classicalAlgorithmNode" || node.type === ClassicalOperatorNode) return 'minimap-node-circle';
                if (node.type === 'rounded') return 'minimap-node-rounded';
                return 'minimap-node-default';
              }}
              nodeColor={(node) => {
                switch (node.type) {
                  case 'dataTypeNode':
                  case 'classicalAlgorithmNode':
                  case ClassicalOperatorNode:
                  case 'rounded':
                    return classicalConstructColor;
                  case 'ancillaNode':
                    return ancillaConstructColor;
                  case 'ifElseNode':
                  case 'controlStructureNode':
                    return controlFlowConstructColor;
                  default:
                    return quantumConstructColor
                }
              }}
              nodeComponent={({ className, x, y, width, height, color }) => {
                const borderRadius = className.includes('circle')
                  ? 100
                  : className.includes('rounded')
                    ? 15
                    : 0;

                return (
                  <rect
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    rx={borderRadius}
                    ry={borderRadius}
                    fill={color}
                    stroke="#333"
                  />
                );
              }}
              zoomable={true}
              pannable={true}
            />


            <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
          </ReactFlow>
          {contextMenu.visible && contextMenu.nodeId && (
            <ContextMenu
              id={contextMenu.nodeId}
              top={contextMenu.top}
              left={contextMenu.left}
              onAction={handleAction}
            />
          )}
        </div>

        <div className="relative flex bg-gray-100 h-[calc(100vh_-_60px)]  border-gray-200 border">
          <div
            className={`transition-all duration-300 ${isPanelOpen ? "w-[300px] lg:w-[350px]" : "w-0 overflow-hidden"}`}
          >

            <button
              onClick={togglePanel}
              style={{
                width: "24px",
                paddingLeft: "4px",
              }}
              className={`absolute top-1/2 transform -translate-y-1/2 bg-gray-400 text-white text-center p-2 rounded-r-lg shadow-md hover:bg-gray-600 z-50 ${isPanelOpen ? "-left-0" : "hidden"} ${isValidationOpen ? "hidden" : ""}`}
            >

              {isPanelOpen ? "→" : "←"}
            </button>
            <button
              onClick={togglePanel}
              style={{
                width: "24px"
              }}
              className={`absolute top-1/2 transform -translate-y-1/2 bg-gray-400 text-white p-2 rounded-l-lg shadow-md hover:bg-gray-600 z-50 ${isPanelOpen ? "hidden" : "right-0"} ${isValidationOpen ? "hidden" : ""}`}
            >
              {isPanelOpen ? "→" : "←"}
            </button>


            {isPanelOpen && <CustomPanel metadata={metadata} onUpdateMetadata={setMetadata} />}
          </div>
        </div>


      </main>
    </>
  );
}


export default App;
