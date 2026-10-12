const { sendJson } = require("../lib/security");

// Preview-only diagnostic. Never returns environment variable values or secrets.
module.exports = function handler(req, res) {
  const isPreview = process.env.VERCEL_ENV === "preview";
  const isSecurityBranch = process.env.VERCEL_GIT_COMMIT_REF === "security/preview-shared-password";
  if (!isPreview || !isSecurityBranch) {
    return sendJson(res, 404, { error: "NOT_FOUND" });
  }
  const siteHash = process.env.SITE_PASSWORD_HASH || "";
  const adminHash = process.env.ADMIN_PASSWORD_HASH || "";
  const sessionSecret = process.env.SESSION_SECRET || "";
  const hashLooksValid = (value) => {
    const parts = value.split("$");
    return parts.length === 3 && parts[0] === "scrypt" && parts[1].length > 0 && parts[2].length > 0;
  };
  return sendJson(res, 200, {
    environment: "preview",
    branchMatches: true,
    config: {
      sitePasswordHashPresent: Boolean(siteHash),
      sitePasswordHashFormatLooksValid: hashLooksValid(siteHash),
      adminPasswordHashPresent: Boolean(adminHash),
      adminPasswordHashFormatLooksValid: hashLooksValid(adminHash),
      siteAndAdminHashesDiffer: Boolean(siteHash && adminHash && siteHash !== adminHash),
      sessionSecretPresent: Boolean(sessionSecret),
      sessionSecretLengthAtLeast32: sessionSecret.length >= 32,
      githubTokenPresent: Boolean(process.env.GITHUB_TOKEN),
      githubOwnerPresent: Boolean(process.env.GITHUB_OWNER),
      githubRepoPresent: Boolean(process.env.GITHUB_REPO),
      githubBranchIsSecurityBranch: process.env.GITHUB_BRANCH === "security/preview-shared-password"
    }
  });
};
