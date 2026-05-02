# 🛡️ Architex – Tactical Collaborative Design Suite

🔗 **Live Demo:** [https://architex-whiteboard.vercel.app/](https://architex-whiteboard.vercel.app/)

💻 **Github Repository:** [https://github.com/Ankush23056/Architex.git](https://github.com/Ankush23056/Architex.git)

Architex is a real-time, multi-user design and architecture tool featuring a high-contrast "Tactical" visual aesthetic. Engineered for high-concurrency collaboration, it allows multiple users to design complex systems simultaneously with sub-100ms latency, supported by an integrated AI Architect for instant structural analysis.

This project demonstrates expertise in WebSocket orchestration, distributed state management, and advanced UI/UX design for professional engineering tools.

## ✨ Features

**📡 Real-Time Multi-User Collaboration**

- **Tactical Callsigns:** Users are automatically assigned unique identifiers like GHOST, COBRA, or TITAN.
- **Sub-100ms Sync:** Cursor movements and element updates are broadcast instantly via Socket.io.
- **Global Presence:** See exactly where other engineers are working on the grid in real-time.

**🧠 Polymath AI Architect**

- **Context-Aware Analysis:** An integrated AI agent analyzes diagrams to find bottlenecks or logical gaps.
- **Multi-Disciplinary:** Expert feedback spanning Software Dev, UI/UX, and System Design.
- **Magic Wand Tool:** AI-driven suggestions to optimize your existing layout.

**🛠️ Professional Design Engine**

- **Snap-to-Grid:** Ensuring perfect alignment for architectural precision.
- **Component Replication:** Quick-duplicate tool (DUPL) for rapid scaling of system components.
- **State Persistence:** All diagrams are saved to a global Redis instance, ensuring your work is there when you return.

**🎨 Tactical UI & HUD**

- **Aesthetic:** High-contrast black and electric lime green theme with neon accents.
- **HUD Telemetry:** Bottom-left heads-up display showing system sync status and active object counts.

## 🕹️ How It Works

- **Initialize Grid:** Enter the workspace and receive your tactical callsign.
- **Design Systems:** Use the toolbox to create rectangles, circles, and curved arrows for complex flows.
- **Collaborate:** Share your unique URL with others to have them join your "War Room" instantly.
- **Analyze:** Hit AI ANALYZE to receive professional engineering feedback on your current diagram.

## 🛠️ Tech Stack

- **Frontend:** React.js, Tailwind CSS, Vite
- **Backend:** Node.js, Express.js
- **Real-Time:** Socket.io (with linear interpolation for smooth movement)
- **Database:** Upstash Redis (for distributed state persistence)
- **AI Engine:** Groq (Senior Engineering Polymath Model)
- **Deployment:** Vercel (Frontend) & Render (Backend)

## 🧠 Key Learnings

- **WebSocket Orchestration:** Managing volatile real-time data versus persistent database state.
- **Distributed State Management:** Using Redis to sync data across multiple server instances and clients.
- **Performance Optimization:** Implementing throttling and linear interpolation to eliminate cursor lag.
- **AI Prompt Engineering:** Building a "Polymath" agent that adapts to the diagram's context without tech-stack bias.

## 👤 Author

**Ankush Kumar | Full-Stack Developer**
📍 Mumbai, India
🌐 [Portfolio](https://ankush-dev.netlify.app/)
