import { defineApplication } from "twenty-sdk/define";

import { resolveApplicationIdentity } from "src/constants/application-identity";
import { resolveEnvironment } from "src/constants/environments";
import {
  APP_DESCRIPTION,
  VARIABLE_ONEEYE_API_URL_UNIVERSAL_IDENTIFIER,
} from "src/constants/universal-identifiers";

// Chosen at build time: ONEEYE_ENV=prod|dev|local (default prod), with an optional ONEEYE_API_URL override.
// The value below is only the default; a workspace can still change it.
const { apiUrl } = resolveEnvironment(process.env.ONEEYE_ENV, {
  apiUrl: process.env.ONEEYE_API_URL,
});

// Production identity by default; ONEEYE_APPLICATION_ID selects a separate dev identity (see the module).
const { universalIdentifier, displayName } = resolveApplicationIdentity(
  process.env.ONEEYE_APPLICATION_ID,
);

export default defineApplication({
  universalIdentifier,
  displayName,
  description: APP_DESCRIPTION,
  logo: "public/logo.png",
  galleryImages: [
    "public/screenshot-1.png",
    "public/screenshot-2.png",
    "public/screenshot-3.png",
    "public/screenshot-4.png",
  ],
  applicationVariables: {
    // Where this app reaches the 1eye backend (pairing, disconnect). Not a secret; a self-hosted or
    // QA workspace points it at the matching 1eye environment.
    ONEEYE_API_URL: {
      universalIdentifier: VARIABLE_ONEEYE_API_URL_UNIVERSAL_IDENTIFIER,
      label: "1eye API URL",
      description: "Base URL of the 1eye API this workspace connects to.",
      value: apiUrl,
      isSecret: false,
    },
  },
});
