# Architectural Decisions

## [2026-02-28] Wave 1 Kickoff

**Decision 1: Use GTFS-RT for QLD/WA Transport**
- Rationale: Proven success with Victoria Transport (100% working)
- TransLink QLD provides GTFS-RT feeds
- Transperth WA provides GTFS-RT feeds
- Consistent API interface across all transport MCP servers

**Decision 2: HealthDirect API for Medical Services**
- Official Australian government health service locator
- Free API with no authentication required
- Covers hospitals, clinics, pharmacies nationwide
- Returns GPS coordinates for map integration

**Decision 3: Parallel Execution for Independent Tasks**
- Tasks 1, 2, 3 have no dependencies → run in parallel
- Task 4 depends on 1-3 completion → sequential after
- Expected time saving: ~40% (3 tasks in parallel vs sequential)

**Decision 4: FastMCP Framework for All New Servers**
- Consistent with existing Victoria Transport implementation
- Simpler than raw MCP SDK
- Built-in async support

---

