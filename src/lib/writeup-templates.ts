import type { Category } from "@/lib/categories";

export const WRITEUP_TEMPLATES: Record<Category, string> = {
  web: `## Recon\n\n\n## Vulnerability\n\n\n## Exploitation\n\n\n## Flag\n\n`,
  pwn: `## Binary Analysis\n\n\n## Vulnerability\n\n\n## Exploit Development\n\n\n## Payload\n\n\`\`\`python\n\n\`\`\`\n\n## Flag\n\n`,
  crypto: `## Algorithm Analysis\n\n\n## Attack\n\n\n## Implementation\n\n\`\`\`python\n\n\`\`\`\n\n## Flag\n\n`,
  forensics: `## File Analysis\n\n\n## Investigation\n\n\n## Extraction\n\n\n## Flag\n\n`,
  rev: `## Static Analysis\n\n\n## Dynamic Analysis\n\n\n## Key Logic\n\n\n## Flag\n\n`,
  osint: `## Target Recon\n\n\n## Sources\n\n\n## Pivot Chain\n\n\n## Flag\n\n`,
  misc: `## Observation\n\n\n## Approach\n\n\n## Solution\n\n\n## Flag\n\n`,
};
