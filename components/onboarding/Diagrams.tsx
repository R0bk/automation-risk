export function WorkforceBreakdownDiagram() {
  return (
    <svg viewBox="0 0 1200 380" className="mx-auto h-auto w-full max-w-4xl">
      {/* Main workforce container */}
      <rect
        x="10"
        y="40"
        width="1180"
        height="310"
        rx="16"
        fill="none"
        stroke="rgba(34,28,20,0.25)"
        strokeWidth="1.4"
      />

      {/* Workforce label */}
      <text
        x="600"
        y="105"
        fontSize="36"
        fill="currentColor"
        textAnchor="middle"
        className="font-semibold text-neutral-900"
      >
        Workforce
      </text>
      <text 
        x="600"
        y="150"
        fontSize="30"
        fill="currentColor"
        textAnchor="middle"
        className="font-medium text-neutral-600"
      >
        is made up of roles
      </text>

      {/* Role boxes */}
      <g className="text-neutral-700">
        {/* Role 1 */}
        <rect
          x="90"
          y="180"
          width="320"
          height="140"
          rx="12"
          fill="#ffffff"
          stroke="rgba(34,28,20,0.25)"
          strokeWidth="1.4"
        />
        <g>
          <text
            x="250"
            y="245"
            fontSize="26"
            fill="currentColor"
            textAnchor="middle"
          >
            Role
          </text>
          <text
            x="250"
            y="280"
            fontSize="20"
            fill="rgba(34,28,20,0.6)"
            textAnchor="middle"
          >
            e.g. Cashiers
          </text>
        </g>

        {/* Role 2 (center) */}
        <rect
          x="440"
          y="180"
          width="320"
          height="140"
          rx="12"
          fill="#ffffff"
          stroke="rgba(34,28,20,0.25)"
          strokeWidth="1.4"
        />
        <g>
          <text
            x="600"
            y="245"
            fontSize="26"
            fill="currentColor"
            textAnchor="middle"
          >
            Role
          </text>
          <text
            x="600"
            y="280"
            fontSize="20"
            fill="rgba(34,28,20,0.6)"
            textAnchor="middle"
          >
            e.g. Actuaries
          </text>
        </g>

        {/* Role 3 */}
        <rect
          x="790"
          y="180"
          width="320"
          height="140"
          rx="12"
          fill="#ffffff"
          stroke="rgba(34,28,20,0.25)"
          strokeWidth="1.4"
        />
        <g>
          <text
            x="950"
            y="245"
            fontSize="26"
            fill="currentColor"
            textAnchor="middle"
          >
            Role
          </text>
          <text
            x="950"
            y="280"
            fontSize="20"
            fill="rgba(34,28,20,0.6)"
            textAnchor="middle"
          >
            e.g. Nannies
          </text>
        </g>
      </g>

    </svg>
  );
}

export function RoleToTasksDiagram() {
  return (
    <svg viewBox="0 0 960 400" className="w-full h-auto max-w-4xl mx-auto">
      <defs>
        <marker
          id="role-to-task-arrow"
          viewBox="0 0 6 6"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L6,3 L0,6 Z" fill="currentColor" />
        </marker>
      </defs>

      {/* Role box at top */}
      <rect
        x="360"
        y="40"
        width="240"
        height="120"
        rx="12"
        fill="#ffffff"
        stroke="rgba(34,28,20,0.25)"
        strokeWidth="1.4"
      />
      <text
        x="480"
        y="90"
        fontSize="24"
        fill="currentColor"
        textAnchor="middle"
        className="font-medium text-neutral-700"
      >
        Role
      </text>
      <text
        x="480"
        y="122"
        fontSize="20"
        fill="currentColor"
        textAnchor="middle"
        className="text-neutral-700"
      >
        is made up of tasks
      </text>

      {/* Arrows */}
      <g className="text-neutral-400">
        {/* Left arrow */}
        <line
          x1="420"
          y1="160"
          x2="180"
          y2="240"
          stroke="currentColor"
          strokeWidth="2"
          markerEnd="url(#role-to-task-arrow)"
        />

        {/* Center arrow */}
        <line
          x1="480"
          y1="160"
          x2="480"
          y2="240"
          stroke="currentColor"
          strokeWidth="2"
          markerEnd="url(#role-to-task-arrow)"
        />

        {/* Right arrow */}
        <line
          x1="540"
          y1="160"
          x2="780"
          y2="240"
          stroke="currentColor"
          strokeWidth="2"
          markerEnd="url(#role-to-task-arrow)"
        />
      </g>

      {/* Task boxes at bottom */}
      <g className="text-neutral-700">
        {/* Task 1 */}
        <rect
          x="60"
          y="240"
          width="240"
          height="120"
          rx="12"
          fill="#ffffff"
          stroke="rgba(34,28,20,0.25)"
          strokeWidth="1.4"
        />
        <text
          x="180"
          y="292"
          fontSize="18"
          fill="currentColor"
          textAnchor="middle"
        >
          Task
        </text>
        <text
          x="180"
          y="318"
          fontSize="16"
          fill="rgba(34,28,20,0.6)"
          textAnchor="middle"
        >
          Issue receipts, refunds
        </text>

        {/* Task 2 */}
        <rect
          x="360"
          y="240"
          width="240"
          height="120"
          rx="12"
          fill="#ffffff"
          stroke="rgba(34,28,20,0.25)"
          strokeWidth="1.4"
        />
        <text
          x="480"
          y="292"
          fontSize="18"
          fill="currentColor"
          textAnchor="middle"
        >
          Task
        </text>
        <text
          x="480"
          y="318"
          fontSize="16"
          fill="rgba(34,28,20,0.6)"
          textAnchor="middle"
        >
          Greet customers entering
        </text>

        {/* Task 3 */}
        <rect
          x="660"
          y="240"
          width="240"
          height="120"
          rx="12"
          fill="#ffffff"
          stroke="rgba(34,28,20,0.25)"
          strokeWidth="1.4"
        />
        <text
          x="780"
          y="292"
          fontSize="18"
          fill="currentColor"
          textAnchor="middle"
        >
          Task
        </text>
        <text
          x="780"
          y="318"
          fontSize="16"
          fill="rgba(34,28,20,0.6)"
          textAnchor="middle"
        >
          Answer incoming calls
        </text>
      </g>
    </svg>
  );
}

export function AIUsageDiagram() {
  return (
    <svg viewBox="0 0 800 520" className="w-full h-auto max-w-4xl mx-auto">
      <defs>
        <marker
          id="ai-usage-arrow"
          viewBox="0 0 6 6"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L6,3 L0,6 Z" fill="currentColor" />
        </marker>
      </defs>

      {/* Chat AI box at top */}
  <rect
    x="280"
    y="20"
    width="240"
    height="100"
    rx="12"
    fill="#ffffff"
    stroke="rgba(34,28,20,0.25)"
    strokeWidth="1.4"
  />
      <text
        x="400"
        y="72"
        fontSize="24"
        fill="currentColor"
        textAnchor="middle"
        className="text-neutral-700"
      >
        Chat AI
      </text>
      <text
        x="400"
        y="104"
        fontSize="14"
        fill="currentColor"
        textAnchor="middle"
        className="text-neutral-600"
      >
        e.g. Claude, ChatGPT
      </text>

      {/* Left side - Chat boxes */}
      <g className="text-neutral-700">
        {/* Chat 1 */}
        <rect
          x="60"
          y="180"
          width="200"
          height="80"
          rx="12"
          fill="#ffffff"
          stroke="rgba(34,28,20,0.25)"
          strokeWidth="1.4"
        />
        <text
          x="160"
          y="230"
          fontSize="20"
          fill="currentColor"
          textAnchor="middle"
        >
          Chat
        </text>

        {/* Chat 2 */}
        <rect
          x="60"
          y="300"
          width="200"
          height="80"
          rx="12"
          fill="#ffffff"
          stroke="rgba(34,28,20,0.25)"
          strokeWidth="1.4"
        />
        <text
          x="160"
          y="350"
          fontSize="20"
          fill="currentColor"
          textAnchor="middle"
        >
          Chat
        </text>

        {/* Chat 3 */}
        <rect
          x="60"
          y="420"
          width="200"
          height="80"
          rx="12"
          fill="#ffffff"
          stroke="rgba(34,28,20,0.25)"
          strokeWidth="1.4"
        />
        <text
          x="160"
          y="470"
          fontSize="20"
          fill="currentColor"
          textAnchor="middle"
        >
          Chat
        </text>
      </g>

      {/* Right side - Task boxes */}
      <g className="text-neutral-700">
        {/* Task 1 */}
        <rect
          x="540"
          y="180"
          width="200"
          height="80"
          rx="12"
          fill="#ffffff"
          stroke="rgba(34,28,20,0.25)"
          strokeWidth="1.4"
        />
        <text
          x="640"
          y="230"
          fontSize="20"
          fill="currentColor"
          textAnchor="middle"
        >
          Task
        </text>

        {/* Task 2 */}
        <rect
          x="540"
          y="300"
          width="200"
          height="80"
          rx="12"
          fill="#ffffff"
          stroke="rgba(34,28,20,0.25)"
          strokeWidth="1.4"
        />
        <text
          x="640"
          y="350"
          fontSize="20"
          fill="currentColor"
          textAnchor="middle"
        >
          Task
        </text>

        {/* Task 3 */}
        <rect
          x="540"
          y="420"
          width="200"
          height="80"
          rx="12"
          fill="#ffffff"
          stroke="rgba(34,28,20,0.25)"
          strokeWidth="1.4"
        />
        <text
          x="640"
          y="470"
          fontSize="20"
          fill="currentColor"
          textAnchor="middle"
        >
          Task
        </text>
      </g>

      {/* Arrows from Chat AI to Chats */}
      <g className="text-neutral-400">
        <line
          x1="340"
          y1="120"
          x2="200"
          y2="180"
          stroke="currentColor"
          strokeWidth="2"
          markerEnd="url(#ai-usage-arrow)"
        />
      </g>

      {/* Arrows from Chats to Tasks */}
      <g className="text-neutral-400">
        {/* Chat 1 to Task 1 */}
        <line
          x1="260"
          y1="220"
          x2="540"
          y2="220"
          stroke="currentColor"
          strokeWidth="2"
          markerEnd="url(#ai-usage-arrow)"
        />
        <text
          x="400"
          y="210"
          fontSize="14"
          fill="currentColor"
          textAnchor="middle"
        >
          Related to
        </text>

        {/* Chat 2 to Task 2 */}
        <line
          x1="260"
          y1="340"
          x2="540"
          y2="340"
          stroke="currentColor"
          strokeWidth="2"
          markerEnd="url(#ai-usage-arrow)"
        />
        <text
          x="400"
          y="330"
          fontSize="14"
          fill="currentColor"
          textAnchor="middle"
        >
          Related to
        </text>

        {/* Chat 3 to Task 3 */}
        <line
          x1="260"
          y1="460"
          x2="540"
          y2="460"
          stroke="currentColor"
          strokeWidth="2"
          markerEnd="url(#ai-usage-arrow)"
        />
        <text
          x="400"
          y="450"
          fontSize="14"
          fill="currentColor"
          textAnchor="middle"
        >
          Related to
        </text>
      </g>
    </svg>
  );
}

export function RoleImpactDiagram() {
  return (
    <svg viewBox="0 0 800 350" className="w-full h-auto max-w-4xl mx-auto">
      <defs>
        <marker
          id="role-impact-arrow"
          viewBox="0 0 6 6"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L6,3 L0,6 Z" fill="currentColor" />
        </marker>
      </defs>

      {/* Role box with integrated task mix bar */}
      <rect
        x="270"
        y="30"
        width="260"
        height="160"
        rx="12"
        fill="#ffffff"
        stroke="rgba(34,28,20,0.25)"
        strokeWidth="1.4"
      />
      <text
        x="400"
        y="70"
        fontSize="22"
        fill="currentColor"
        textAnchor="middle"
        className="text-neutral-700 font-medium"
      >
        Role
      </text>
      <text
        x="400"
        y="100"
        fontSize="18"
        fill="#cf2d56"
        textAnchor="middle"
      >
        15% Automated
      </text>
      <text
        x="400"
        y="125"
        fontSize="18"
        fill="rgb(252, 146, 85)"
        textAnchor="middle"
      >
        30% Augmented
      </text>

      {/* Task mix bar inside Role box */}
      <g>
        {/* Bar background */}
        <rect
          x="290"
          y="150"
          width="220"
          height="20"
          rx="6"
          fill="#ffffff"
          stroke="rgba(34,28,20,0.2)"
          strokeWidth="1"
        />

        {/* Automation segment (15%) */}
        <rect
          x="290"
          y="150"
          width="33"
          height="20"
          rx="4"
          fill="#cf2d56"
        />

        {/* Augmentation segment (30%) */}
        <rect
          x="323"
          y="150"
          width="66"
          height="20"
          fill="rgb(252, 146, 85)"
        />

        {/* Manual segment (55%) */}
        <rect
          x="389"
          y="150"
          width="121"
          height="20"
          fill="rgba(34,28,20,0.15)"
        />
      </g>

      {/* Task boxes */}
      <g className="text-neutral-700">
        {/* Task 1 - left */}
        <rect
          x="80"
          y="220"
          width="160"
          height="80"
          rx="12"
          fill="#ffffff"
          stroke="rgba(34,28,20,0.25)"
          strokeWidth="1.4"
        />
        <text
          x="160"
          y="270"
          fontSize="20"
          fill="currentColor"
          textAnchor="middle"
        >
          Task
        </text>

        {/* Task 2 - center */}
        <rect
          x="320"
          y="220"
          width="160"
          height="80"
          rx="12"
          fill="#ffffff"
          stroke="rgba(34,28,20,0.25)"
          strokeWidth="1.4"
        />
        <text
          x="400"
          y="270"
          fontSize="20"
          fill="currentColor"
          textAnchor="middle"
        >
          Task
        </text>

        {/* Task 3 - right */}
        <rect
          x="560"
          y="220"
          width="160"
          height="80"
          rx="12"
          fill="#ffffff"
          stroke="rgba(34,28,20,0.25)"
          strokeWidth="1.4"
        />
        <text
          x="640"
          y="270"
          fontSize="20"
          fill="currentColor"
          textAnchor="middle"
        >
          Task
        </text>
      </g>

      {/* Arrows from tasks to role */}
      <g className="text-neutral-400">
        {/* Left arrow */}
        <line
          x1="180"
          y1="220"
          x2="340"
          y2="190"
          stroke="currentColor"
          strokeWidth="2"
          markerEnd="url(#role-impact-arrow)"
        />

        {/* Center arrow */}
        <line
          x1="400"
          y1="220"
          x2="400"
          y2="190"
          stroke="currentColor"
          strokeWidth="2"
          markerEnd="url(#role-impact-arrow)"
        />

        {/* Right arrow */}
        <line
          x1="620"
          y1="220"
          x2="460"
          y2="190"
          stroke="currentColor"
          strokeWidth="2"
          markerEnd="url(#role-impact-arrow)"
        />
      </g>
    </svg>
  );
}

export function OrgResearchDiagram() {
  const teams = [
    { x: 110, title: "Platform Eng", headcount: "~160", automation: 0.28, augmentation: 0.47 },
    { x: 230, title: "Applied AI", headcount: "~130", automation: 0.18, augmentation: 0.62 },
    { x: 350, title: "Design Ops", headcount: "~130", automation: 0.12, augmentation: 0.51 },
    { x: 490, title: "Customer Support", headcount: "~190", automation: 0.42, augmentation: 0.38 },
    { x: 650, title: "Field Ops", headcount: "~110", automation: 0.35, augmentation: 0.33 },
    { x: 810, title: "Compliance", headcount: "~60", automation: 0.15, augmentation: 0.41 },
  ];

  return (
    <svg viewBox="0 0 1040 460" className="w-full h-auto max-w-5xl mx-auto">
      <rect
        x="36"
        y="36"
        width="968"
        height="388"
        rx="18"
        fill="none"
        stroke="rgba(34,28,20,0.08)"
        strokeDasharray="12 12"
      />

      <rect
        x="380"
        y="58"
        width="200"
        height="92"
        rx="14"
        fill="#ffffff"
        stroke="rgba(34,28,20,0.25)"
        strokeWidth="1.4"
      />
      <text x="480" y="93" textAnchor="middle" fontSize="20" fontWeight="600" fill="#111827">
        Company
      </text>
      <text x="480" y="117" textAnchor="middle" fontSize="13" fill="#6b7280">
        Headcount inferred: 1,150
      </text>
      <text x="480" y="136" textAnchor="middle" fontSize="11" fill="#9ca3af">
        10-K • LinkedIn • hiring feeds
      </text>

      <line x1="480" y1="150" x2="260" y2="210" stroke="rgba(34,28,20,0.3)" strokeWidth="2" />
      <line x1="480" y1="150" x2="700" y2="210" stroke="rgba(34,28,20,0.3)" strokeWidth="2" />

      <rect
        x="180"
        y="210"
        width="160"
        height="82"
        rx="12"
        fill="#ffffff"
        stroke="rgba(34,28,20,0.25)"
        strokeWidth="1.4"
      />
      <text x="260" y="242" textAnchor="middle" fontSize="16" fontWeight="600" fill="#111827">
        Product Org
      </text>
      <text x="260" y="264" textAnchor="middle" fontSize="12" fill="#6b7280">
        ~420 roles
      </text>

      <rect
        x="620"
        y="210"
        width="160"
        height="82"
        rx="12"
        fill="#ffffff"
        stroke="rgba(34,28,20,0.25)"
        strokeWidth="1.4"
      />
      <text x="700" y="242" textAnchor="middle" fontSize="16" fontWeight="600" fill="#111827">
        Operations
      </text>
      <text x="700" y="264" textAnchor="middle" fontSize="12" fill="#6b7280">
        ~360 roles
      </text>

      <line x1="260" y1="292" x2="190" y2="340" stroke="rgba(34,28,20,0.2)" strokeWidth="2" />
      <line x1="260" y1="292" x2="310" y2="340" stroke="rgba(34,28,20,0.2)" strokeWidth="2" />
      <line x1="260" y1="292" x2="430" y2="340" stroke="rgba(34,28,20,0.2)" strokeWidth="2" />
      <line x1="700" y1="292" x2="570" y2="340" stroke="rgba(34,28,20,0.2)" strokeWidth="2" />
      <line x1="700" y1="292" x2="730" y2="340" stroke="rgba(34,28,20,0.2)" strokeWidth="2" />
      <line x1="700" y1="292" x2="890" y2="340" stroke="rgba(34,28,20,0.2)" strokeWidth="2" />

      {teams.map((team, idx) => {
        const total = 140;
        const automation = Math.round(total * team.automation);
        const augmentation = Math.round(total * team.augmentation);
        const manual = Math.max(0, total - automation - augmentation);
        return (
          <g key={idx}>
            <rect
              x={team.x}
              y={340}
              width={160}
              height={80}
              rx="12"
              fill="#ffffff"
              stroke="rgba(34,28,20,0.25)"
              strokeWidth="1.4"
            />
            <text x={team.x + 80} y={366} textAnchor="middle" fontSize="14" fontWeight="600" fill="#111827">
              {team.title}
            </text>
            <text x={team.x + 80} y={384} textAnchor="middle" fontSize="11" fill="#6b7280">
              {team.headcount}
            </text>
            <rect
              x={team.x + 10}
              y={392}
              width={140}
              height={18}
              rx="6"
              fill="rgba(34,28,20,0.08)"
            />
            <rect x={team.x + 10} y={392} width={automation} height={18} rx="6" fill="#cf2d56" />
            <rect
              x={team.x + 10 + automation}
              y={392}
              width={augmentation}
              height={18}
              fill="rgb(252, 146, 85)"
            />
            <rect
              x={team.x + 10 + automation + augmentation}
              y={392}
              width={manual}
              height={18}
              fill="rgba(34,28,20,0.18)"
            />
            <text x={team.x + 80} y={414} textAnchor="middle" fontSize="10" fill="#6b7280">
              automation / augmentation / manual
            </text>
          </g>
        );
      })}

      <g>
        <rect x="70" y="86" width="12" height="12" rx="3" fill="#cf2d56" />
        <text x="90" y="96" fontSize="11" fill="#374151">
          Automation exposure
        </text>
        <rect x="70" y="106" width="12" height="12" rx="3" fill="rgb(252, 146, 85)" />
        <text x="90" y="116" fontSize="11" fill="#374151">
          Augmentation exposure
        </text>
        <rect x="70" y="126" width="12" height="12" rx="3" fill="rgba(34,28,20,0.25)" />
        <text x="90" y="136" fontSize="11" fill="#374151">
          Manual / unscored
        </text>
      </g>
    </svg>
  );
}

export function TaskClassificationDiagram() {
  return (
    <svg viewBox="0 0 1100 500" className="w-full h-auto max-w-5xl mx-auto">
      <defs>
        <marker
          id="task-class-neutral"
          viewBox="0 0 6 6"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L6,3 L0,6 Z" fill="currentColor" />
        </marker>
        <marker
          id="task-class-automation"
          viewBox="0 0 6 6"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L6,3 L0,6 Z" fill="#cf2d56" />
        </marker>
        <marker
          id="task-class-augmentation"
          viewBox="0 0 6 6"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L6,3 L0,6 Z" fill="rgb(252, 146, 85)" />
        </marker>
      </defs>

      {/* Chat AI box */}
      <rect
        x="120"
        y="30"
        width="180"
        height="80"
        rx="12"
        fill="#ffffff"
        stroke="rgba(34,28,20,0.25)"
        strokeWidth="1.4"
      />
      <text
        x="210"
        y="72"
        fontSize="20"
        fill="currentColor"
        textAnchor="middle"
        className="text-neutral-700"
      >
        Chat AI
      </text>
      <text
        x="210"
        y="100"
        fontSize="12"
        fill="currentColor"
        textAnchor="middle"
        className="text-neutral-600"
      >
        (e.g. Claude, ChatGPT)
      </text>

      {/* Chat boxes */}
      <g className="text-neutral-700">
        {/* Chat 1 */}
        <rect
          x="40"
          y="160"
          width="140"
          height="60"
          rx="12"
          fill="#ffffff"
          stroke="rgba(34,28,20,0.25)"
          strokeWidth="1.4"
        />
        <text
          x="110"
          y="197"
          fontSize="18"
          fill="currentColor"
          textAnchor="middle"
        >
          Chat
        </text>

        {/* Chat 2 */}
        <rect
          x="40"
          y="250"
          width="140"
          height="60"
          rx="12"
          fill="#ffffff"
          stroke="rgba(34,28,20,0.25)"
          strokeWidth="1.4"
        />
        <text
          x="110"
          y="287"
          fontSize="18"
          fill="currentColor"
          textAnchor="middle"
        >
          Chat
        </text>

        {/* Chat 3 */}
        <rect
          x="40"
          y="340"
          width="140"
          height="60"
          rx="12"
          fill="#ffffff"
          stroke="rgba(34,28,20,0.25)"
          strokeWidth="1.4"
        />
        <text
          x="110"
          y="377"
          fontSize="18"
          fill="currentColor"
          textAnchor="middle"
        >
          Chat
        </text>
      </g>

      {/* Task boxes */}
      <g className="text-neutral-700">
        {/* Task 1 */}
        <rect
          x="350"
          y="160"
          width="140"
          height="60"
          rx="12"
          fill="#ffffff"
          stroke="rgba(34,28,20,0.25)"
          strokeWidth="1.4"
        />
        <text
          x="420"
          y="197"
          fontSize="18"
          fill="currentColor"
          textAnchor="middle"
        >
          Task
        </text>

        {/* Task 2 */}
        <rect
          x="350"
          y="250"
          width="140"
          height="60"
          rx="12"
          fill="#ffffff"
          stroke="rgba(34,28,20,0.25)"
          strokeWidth="1.4"
        />
        <text
          x="420"
          y="287"
          fontSize="18"
          fill="currentColor"
          textAnchor="middle"
        >
          Task
        </text>

        {/* Task 3 */}
        <rect
          x="350"
          y="340"
          width="140"
          height="60"
          rx="12"
          fill="#ffffff"
          stroke="rgba(34,28,20,0.25)"
          strokeWidth="1.4"
        />
        <text
          x="420"
          y="377"
          fontSize="18"
          fill="currentColor"
          textAnchor="middle"
        >
          Task
        </text>
      </g>

      {/* Classification boxes */}
      <g>
        {/* Automation box */}
        <rect
          x="700"
          y="160"
          width="180"
          height="80"
          rx="12"
          fill="white"
          stroke="#cf2d56"
          strokeWidth="2"
        />
        <text
          x="790"
          y="210"
          fontSize="20"
          fill="#cf2d56"
          textAnchor="middle"
          className="font-medium"
        >
          Automation
        </text>

        {/* Augmentation box */}
        <rect
          x="700"
          y="300"
          width="180"
          height="80"
          rx="12"
          fill="white"
          stroke="rgb(252, 146, 85)"
          strokeWidth="2"
        />
        <text
          x="790"
          y="350"
          fontSize="20"
          fill="rgb(252, 146, 85)"
          textAnchor="middle"
          className="font-medium"
        >
          Augmentation
        </text>
      </g>

      {/* Arrows from Chat AI to Chats */}
      <g className="text-neutral-400">
        <line
          x1="180"
          y1="110"
          x2="120"
          y2="160"
          stroke="currentColor"
          strokeWidth="2"
          markerEnd="url(#task-class-neutral)"
        />
      </g>

      {/* Arrows from Chats to Tasks with "Related to" labels */}
      <g className="text-neutral-400">
        {/* Chat 1 to Task 1 */}
        <line
          x1="180"
          y1="190"
          x2="350"
          y2="190"
          stroke="currentColor"
          strokeWidth="2"
          markerEnd="url(#task-class-neutral)"
        />
        <text
          x="265"
          y="180"
          fontSize="12"
          fill="currentColor"
          textAnchor="middle"
        >
          Related to
        </text>

        {/* Chat 2 to Task 2 */}
        <line
          x1="180"
          y1="280"
          x2="350"
          y2="280"
          stroke="currentColor"
          strokeWidth="2"
          markerEnd="url(#task-class-neutral)"
        />
        <text
          x="265"
          y="270"
          fontSize="12"
          fill="currentColor"
          textAnchor="middle"
        >
          Related to
        </text>

        {/* Chat 3 to Task 3 */}
        <line
          x1="180"
          y1="370"
          x2="350"
          y2="370"
          stroke="currentColor"
          strokeWidth="2"
          markerEnd="url(#task-class-neutral)"
        />
        <text
          x="265"
          y="360"
          fontSize="12"
          fill="currentColor"
          textAnchor="middle"
        >
          Related to
        </text>
      </g>

      {/* Arrows from Tasks to Classification with "Classify" labels */}
      <g>
        {/* Task 1 to Automation */}
        <line
          x1="490"
          y1="190"
          x2="700"
          y2="200"
          stroke="#cf2d56"
          strokeWidth="2"
          markerEnd="url(#task-class-automation)"
        />
        <text
          x="595"
          y="185"
          fontSize="12"
          fill="#cf2d56"
          textAnchor="middle"
        >
          Classify
        </text>

        {/* Task 2 to Augmentation */}
        <line
          x1="490"
          y1="280"
          x2="700"
          y2="330"
          stroke="rgb(252, 146, 85)"
          strokeWidth="2"
          markerEnd="url(#task-class-augmentation)"
        />
        <text
          x="595"
          y="300"
          fontSize="12"
          fill="rgb(252, 146, 85)"
          textAnchor="middle"
        >
          Classify
        </text>

        {/* Task 3 to Augmentation */}
        <line
          x1="490"
          y1="370"
          x2="700"
          y2="350"
          stroke="rgb(252, 146, 85)"
          strokeWidth="2"
          markerEnd="url(#task-class-augmentation)"
        />
        <text
          x="595"
          y="365"
          fontSize="12"
          fill="rgb(252, 146, 85)"
          textAnchor="middle"
        >
          Classify
        </text>
      </g>
    </svg>
  );
}

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

export function MiniOrg() {
  // Tiny org with bars per node
  const nodes = [
    { x: 10, y: 10, label: "Finance", a: 0.35, g: 0.45, m: 0.20 },
    { x: 10, y: 70, label: "Ops", a: 0.50, g: 0.30, m: 0.20 },
    { x: 260, y: 40, label: "Analytics", a: 0.25, g: 0.60, m: 0.15 },
  ];
  return (
    <svg viewBox="0 0 520 120" className="mt-3 h-28 w-full" aria-label="Mini org chart">
      {/* Edges */}
      <path d="M150 26 L240 50" stroke="rgba(34,28,20,0.3)" />
      <path d="M150 86 L240 60" stroke="rgba(34,28,20,0.3)" />
      {nodes.map((n, i) => (
        <g key={i} transform={`translate(${n.x}, ${n.y})`}>
          <rect width="200" height="48" rx="10" ry="10" fill="#ffffff" stroke="rgba(34,28,20,0.25)" />
          <text x="12" y="18" fontSize="12" fill="#111827">{n.label}</text>
          <g transform="translate(12,24)">
            <rect width="176" height="12" fill="none" stroke="rgba(34,28,20,0.2)" rx="6" ry="6" />
            <rect width={176 * n.a} height="12" fill="#cf2d56" rx="6" ry="6" />
            <rect x={176 * n.a} width={176 * n.g} height="12" fill="rgb(252, 146, 85)" />
          </g>
          <text x="190" y="18" textAnchor="end" fontSize="10" fill="#4b5563">
            A {pct(n.a)} · G {pct(n.g)} · M {pct(n.m)}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function MiniFlow() {
  // Org -> Industry -> Country flow
  return (
    <svg viewBox="0 0 560 100" className="mt-1 h-24 w-full" aria-label="Aggregation flow">
      {[
        { x: 20, label: "Org" },
        { x: 220, label: "Industry" },
        { x: 420, label: "Country" },
      ].map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={22} width="120" height="56" rx="12" ry="12" fill="#ffffff" stroke="rgba(34,28,20,0.25)" />
          <text x={b.x + 60} y={50} textAnchor="middle" fontSize="13" fill="#111827" fontWeight={600}>
            {b.label}
          </text>
          <Segment x={b.x + 12} y={58} w={96} a={0.3 + i * 0.05} g={0.5 - i * 0.05} />
        </g>
      ))}
      <defs>
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 z" fill="rgba(34,28,20,0.35)" />
        </marker>
      </defs>
      <line x1="140" y1="50" x2="220" y2="50" stroke="rgba(34,28,20,0.35)" markerEnd="url(#arrow)" />
      <line x1="340" y1="50" x2="420" y2="50" stroke="rgba(34,28,20,0.35)" markerEnd="url(#arrow)" />
    </svg>
  );
}

export function Segment({ x, y, w, a, g }: { x: number; y: number; w: number; a: number; g: number }) {
  const A = Math.round(w * a);
  const G = Math.round(w * g);
  return (
    <g>
      <rect x={x} y={y} width={w} height="8" fill="rgba(34,28,20,0.12)" rx="4" ry="4" />
      <rect x={x} y={y} width={A} height="8" fill="#cf2d56" rx="4" ry="4" />
      <rect x={x + A} y={y} width={G} height="8" fill="rgb(252, 146, 85)" />
    </g>
  );
}
