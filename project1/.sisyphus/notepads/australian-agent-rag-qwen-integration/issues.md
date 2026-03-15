# Issues & Gotchas

## [2026-02-28] Pre-Wave 1

**Known Issues from Victoria Transport**:
1. Service alerts endpoints can return 404 for Bus/V/Line
   - Solution: Automatic fallback to Metro alerts
   - Apply same pattern to QLD/WA if needed

2. V/Line GPS returns empty in CBD
   - Not a bug: Regional trains operate outside city
   - Document expected behavior for regional services

3. CKAN API unreliable for dataset discovery
   - Solution: Use direct feed URLs instead
   - Pre-configure URLs in code, don't query dynamically

**Potential Issues for Wave 1**:
- QLD/WA GTFS-RT feeds might have different authentication methods
- HealthDirect API rate limits unknown (need to test)
- Time zone handling (AEST for NSW/VIC, AEST for QLD, AWST for WA)

---

