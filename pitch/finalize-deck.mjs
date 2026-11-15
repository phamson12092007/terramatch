import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

process.env.RUNTIME_NODE_MODULES='C:/Users/MSII/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES=process.env.RUNTIME_NODE_MODULES;
const skillDir='C:/Users/MSII/.codex/plugins/cache/openai-primary-runtime/presentations/26.1112.11217/skills/Presentations';
const workspaceDir='D:/moon/terramatch-main/pitch';
const candidatePath=path.join(workspaceDir,'build','acs-aerotech-draft.pptx');
const finalPath=path.join(workspaceDir,'output','ACS-AEROTECH-Pitch-VI.pptx');
const stagingDir=path.join(workspaceDir,'build','.codex-finalizer');
await fs.mkdir(stagingDir,{recursive:true});
await fs.mkdir(path.dirname(finalPath),{recursive:true});
const {finalizePresentation}=await import(pathToFileURL(path.join(skillDir,'container_tools/artifact_tool_utils.mjs')).href);
const result=await finalizePresentation({
  explicitTotalSlideCount:7,
  requiredNativeTableOwnerSlides:[],
  requiredNativeChartOwnerSlides:[],
  workspaceDir,
  candidatePath,
  finalPath,
  pythonExecutable:'C:/Users/MSII/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',
  integrityValidatorPath:path.join(skillDir,'container_tools/inspect_presentation_package_integrity.py'),
  layoutValidatorPath:path.join(skillDir,'container_tools/inspect_presentation_layout_geometry.py'),
  layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit'],
  fontPolicy:{basis:'design',families:['Arial']},
  verifyArtifactToolImport:true,
  receiptPath:path.join(stagingDir,'ACS-AEROTECH-Pitch-VI.validation.json'),
});
console.log(JSON.stringify(result));
