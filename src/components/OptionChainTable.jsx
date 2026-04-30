import React from "react";

const OptionChainTable = ({ loading, optionChain }) => {
    if (loading) {
        return <p>Loading option chain...</p>;
    }

    return (
        <div style={{ overflowX: "auto" }}>
            <table
                border="1"
                cellPadding="8"
                cellSpacing="0"
                style={{
                    width: "100%",
                    borderCollapse: "collapse",
                }}
            >
                <thead>
                    <tr>
                        <th>CE OI</th>
                        <th>CE change OI</th>
                        <th>CE LTP</th>
                        <th>CE Vol</th>
                        <th>Strike</th>
                        <th>PE Vol</th>
                        <th>PE LTP</th>
                        <th>PE change OI</th>
                        <th>PE OI</th>
                    </tr>
                </thead>
<tbody>
  {(() => {
    try {

      // ─────────────────────────────────────────────────────
      // HELPERS
      // ─────────────────────────────────────────────────────
      const snap = (v) => Math.round(v / 12.5) * 12.5;
      const L    = (n) => Number(n || 0).toLocaleString("en-IN");
      const safe = (n) => Number(n || 0);

      const spot = safe(
        optionChain?.[0]?.CE?.underlyingValue ||
        optionChain?.[0]?.PE?.underlyingValue || 0
      );

      // ─────────────────────────────────────────────────────
      // STEP 1 — S/R FORMULA  ← FIXED
      // RESISTANCE: nearest strike above spot where CE OI > PE OI
      //   (weighted by OI concentration, not just ratio)
      // SUPPORT: nearest strike below spot where PE OI > CE OI
      // ─────────────────────────────────────────────────────
      const roundRows = optionChain.filter(
        (r) => Number(r.strikePrice) % 100 === 0
      );

      // ── RESISTANCE FIX ──
      // Among all strikes ABOVE spot, find the one with the highest
      // CE OI that is ALSO nearest to spot. We weight by:
      //   ceOI / (distance + 1)  → big OI nearby beats huge OI far away
      const ceAboveSpot = roundRows
        .filter(r => safe(r.strikePrice) > spot && safe(r.CE?.openInterest) > 0)
        .map(r => ({
          r,
          strike: safe(r.strikePrice),
          ceOI: safe(r.CE?.openInterest),
          peOI: safe(r.PE?.openInterest),
          dist: safe(r.strikePrice) - spot,
        }))
        .filter(x => x.ceOI > x.peOI);   // must have more CE than PE

      // Sort by proximity-weighted CE OI score (nearest heavy wall wins)
      ceAboveSpot.sort((a, b) => {
        const scoreA = a.ceOI / (a.dist + 1);
        const scoreB = b.ceOI / (b.dist + 1);
        return scoreB - scoreA;
      });
      const firstResistance = ceAboveSpot[0]?.r || null;

      // ── SUPPORT FIX ── (same logic, below spot, PE side)
      const peBelowSpot = roundRows
        .filter(r => safe(r.strikePrice) < spot && safe(r.PE?.openInterest) > 0)
        .map(r => ({
          r,
          strike: safe(r.strikePrice),
          peOI: safe(r.PE?.openInterest),
          ceOI: safe(r.CE?.openInterest),
          dist: spot - safe(r.strikePrice),
        }))
        .filter(x => x.peOI > x.ceOI);   // must have more PE than CE

      peBelowSpot.sort((a, b) => {
        const scoreA = a.peOI / (a.dist + 1);
        const scoreB = b.peOI / (b.dist + 1);
        return scoreB - scoreA;
      });
      const lastSupport = peBelowSpot[0]?.r || null;

      const supportStrike    = safe(lastSupport?.strikePrice);
      const resistanceStrike = safe(firstResistance?.strikePrice);

      // ─────────────────────────────────────────────────────
      // STEP 2 — PRECISE LEVELS  ← UNCHANGED
      // ─────────────────────────────────────────────────────
      let preciseResistance = resistanceStrike;
      if (resistanceStrike > 0) {
        const rr = optionChain.find((r) => safe(r.strikePrice) === resistanceStrike);
        const nr = optionChain.find((r) => safe(r.strikePrice) === resistanceStrike - 50);
        const v1 = safe(rr?.CE?.totalTradedVolume);
        const v2 = safe(nr?.CE?.totalTradedVolume);
        if (v1 + v2 > 0) {
          const raw = resistanceStrike - (v2 / (v1 + v2)) * 50;
          preciseResistance = Math.max(resistanceStrike - 50, Math.min(resistanceStrike, snap(raw)));
        }
      }

      let preciseSupport = supportStrike;
      if (supportStrike > 0) {
        const sr = optionChain.find((r) => safe(r.strikePrice) === supportStrike);
        const ns = optionChain.find((r) => safe(r.strikePrice) === supportStrike + 50);
        const v1 = safe(sr?.PE?.totalTradedVolume);
        const v2 = safe(ns?.PE?.totalTradedVolume);
        if (v1 + v2 > 0) {
          const raw = supportStrike + (v2 / (v1 + v2)) * 50;
          preciseSupport = Math.max(supportStrike, Math.min(supportStrike + 50, snap(raw)));
        }
      }

      // ─────────────────────────────────────────────────────
      // STEP 3 — ORIGINAL MARKET DRIVER  ← UNCHANGED
      // ─────────────────────────────────────────────────────
      const nearbyRows = roundRows.filter(
        (r) => Math.abs(safe(r.strikePrice) - spot) <= 300
      );

      const metricLeaders = nearbyRows.map((r) => {
        const strike  = safe(r.strikePrice);
        const ceOI    = safe(r.CE?.openInterest);
        const peOI    = safe(r.PE?.openInterest);
        const ceChgOI = safe(r.CE?.changeinOpenInterest);
        const peChgOI = safe(r.PE?.changeinOpenInterest);
        const ceVol   = safe(r.CE?.totalTradedVolume);
        const peVol   = safe(r.PE?.totalTradedVolume);
        const ceP = (ceChgOI>peChgOI?3:0)+(ceVol>peVol?2:0)+(ceOI>peOI?1:0);
        const peP = (peChgOI>ceChgOI?3:0)+(peVol>ceVol?2:0)+(peOI>ceOI?1:0);
        const net = peP - ceP;
        return {
          strike, netPressure: net,
          distance:      Math.abs(strike - spot),
          dominantSide:  net > 0 ? "PE" : net < 0 ? "CE" : null,
          totalStrength: Math.abs(net),
        };
      });

      const sortedDrivers = [...metricLeaders].sort((a, b) =>
        b.totalStrength !== a.totalStrength
          ? b.totalStrength - a.totalStrength
          : a.distance - b.distance
      );
      const driver1       = sortedDrivers[0];
      const driver2       = sortedDrivers[1];
      const driverStrike  = driver1?.strike  || 0;
      const driver2Strike = driver2?.strike  || 0;
      const marketDir     =
        driver1?.netPressure > 0 ? "UPSIDE"
        : driver1?.netPressure < 0 ? "DOWNSIDE"
        : "SIDEWAYS";
      const targetStrike  =
        marketDir === "UPSIDE"    ? resistanceStrike
        : marketDir === "DOWNSIDE" ? supportStrike
        : spot;

      // ─────────────────────────────────────────────────────
      // STEP 4 — FULL WEIGHTED DATA for every strike
      // ─────────────────────────────────────────────────────
      const BREAK_PCT = 30;

      const weighted = optionChain.map((r) => {
        const strike  = safe(r.strikePrice);
        const ceOI    = safe(r.CE?.openInterest);
        const peOI    = safe(r.PE?.openInterest);
        const ceChg   = safe(r.CE?.changeinOpenInterest);
        const peChg   = safe(r.PE?.changeinOpenInterest);
        const ceVol   = safe(r.CE?.totalTradedVolume);
        const peVol   = safe(r.PE?.totalTradedVolume);
        const ceW     = ceOI + Math.abs(ceChg) + ceVol;
        const peW     = peOI + Math.abs(peChg) + peVol;

        const ceUnwound   = ceOI > 0 ? Math.max(0, -ceChg / ceOI * 100) : 0;
        const ceBreakLeft = Math.max(0, BREAK_PCT - ceUnwound);
        const ceBuilding  = ceChg > 0;
        const ceBuildPct  = ceOI > 0 ? (ceChg / ceOI * 100) : 0;

        const peUnwound   = peOI > 0 ? Math.max(0, -peChg / peOI * 100) : 0;
        const peBreakLeft = Math.max(0, BREAK_PCT - peUnwound);
        const peBuilding  = peChg > 0;
        const peBuildPct  = peOI > 0 ? (peChg / peOI * 100) : 0;

        const nextUpRow  = optionChain.find(x => safe(x.strikePrice) === strike + 50);
        const v1pe       = peVol;
        const v2pe       = safe(nextUpRow?.PE?.totalTradedVolume);
        const preciseS   = v1pe + v2pe > 0
          ? Math.max(strike, Math.min(strike + 50, snap(strike + (v2pe / (v1pe + v2pe)) * 50)))
          : strike;

        const nextDnRow  = optionChain.find(x => safe(x.strikePrice) === strike - 50);
        const v1ce       = ceVol;
        const v2ce       = safe(nextDnRow?.CE?.totalTradedVolume);
        const preciseR   = v1ce + v2ce > 0
          ? Math.max(strike - 50, Math.min(strike, snap(strike - (v2ce / (v1ce + v2ce)) * 50)))
          : strike;

        // ALL 3 must be true for confirmed levels
        const isConfirmedSupport    = peOI > ceOI && peChg > 0 && peVol > ceVol;
        const isConfirmedResistance = ceOI > peOI && ceChg > 0 && ceVol > peVol;

        const peRatio = ceOI > 0 ? peOI / ceOI : 0;
        const ceRatio = peOI > 0 ? ceOI / peOI : 0;

        const supportTag =
          peChg > 0 && peRatio >= 5 ? "BAHUT MAZBOOT 💪"
          : peChg > 0 && peRatio >= 2 ? "MAZBOOT 👍"
          : peChg > 0               ? "THODA MAZBOOT"
          : peChg < 0               ? "KAMZOR 🔓"
          : "NEUTRAL";

        const resistTag =
          ceChg > 0 && ceRatio >= 5 ? "BAHUT MAZBOOT 💪"
          : ceChg > 0 && ceRatio >= 2 ? "MAZBOOT 👍"
          : ceChg > 0               ? "THODA MAZBOOT"
          : ceChg < 0               ? "KAMZOR 🔓"
          : "NEUTRAL";

        return {
          strike, ceOI, peOI, ceChg, peChg, ceVol, peVol, ceW, peW,
          ceUnwound, ceBreakLeft, ceBuilding, ceBuildPct,
          peUnwound, peBreakLeft, peBuilding, peBuildPct,
          preciseS, preciseR,
          isConfirmedSupport, isConfirmedResistance,
          supportTag, resistTag, peRatio, ceRatio,
        };
      });

      // ─────────────────────────────────────────────────────
      // STEP 5 — BARRIER WALLS
      // ─────────────────────────────────────────────────────
      const ceRanked = [...weighted]
        .filter(x => x.ceW > x.peW && x.ceOI > 0)
        .sort((a, b) => b.ceW - a.ceW);
      const peRanked = [...weighted]
        .filter(x => x.peW > x.ceW && x.peOI > 0)
        .sort((a, b) => b.peW - a.peW);

      const ceB1 = ceRanked[0] || null;
      const ceB2 = ceRanked[1] || null;
      const peB1 = peRanked[0] || null;
      const peB2 = peRanked[1] || null;

      const ceDoubleWall = !!(ceB1 && ceB2 && ceB2.ceW >= ceB1.ceW * 0.75);
      const peDoubleWall = !!(peB1 && peB2 && peB2.peW >= peB1.peW * 0.75);

      const rangeHi = ceB1?.strike || 0;
      const rangeLo = peB1?.strike || 0;

      // PCR
      const totalCeOI = weighted.reduce((s, x) => s + x.ceOI, 0);
      const totalPeOI = weighted.reduce((s, x) => s + x.peOI, 0);
      const pcr       = totalCeOI > 0 ? totalPeOI / totalCeOI : 0;
      const pcrLabel  = pcr > 1.3 ? "Bullish" : pcr < 0.7 ? "Bearish" : "Neutral";

      // ─────────────────────────────────────────────────────
      // STEP 6 — CONFIRMED SUPPORTS & RESISTANCES  ← FIXED
      //
      // KEY FIX: Add proximity bonus so the NEAREST confirmed
      // level above/below spot ranks highest, not the one with
      // the most raw OI far away.
      //
      // Proximity multiplier: 1 / (1 + distance/500)
      //   → strike 100 pts away: 0.83×   (slight penalty)
      //   → strike 500 pts away: 0.50×   (big penalty)
      //   → strike 50 pts away:  0.91×   (barely penalised)
      // ─────────────────────────────────────────────────────
      const confirmedSupports = weighted
        .filter(x => x.isConfirmedSupport)
        .map(x => {
          const dist = Math.abs(x.strike - spot);
          const proximityMult = 1 / (1 + dist / 500);
          return {
            ...x,
            score: (x.peOI * 3 + x.peChg * 2 + x.peVol) * proximityMult,
          };
        })
        .sort((a, b) => b.score - a.score);

      const confirmedResistances = weighted
        .filter(x => x.isConfirmedResistance)
        .map(x => {
          const dist = Math.abs(x.strike - spot);
          const proximityMult = 1 / (1 + dist / 500);
          return {
            ...x,
            score: (x.ceOI * 3 + x.ceChg * 2 + x.ceVol) * proximityMult,
          };
        })
        .sort((a, b) => b.score - a.score);

      const sup1 = confirmedSupports[0]    || null;
      const sup2 = confirmedSupports[1]    || null;
      const sup3 = confirmedSupports[2]    || null;
      const res1 = confirmedResistances[0] || null;
      const res2 = confirmedResistances[1] || null;
      const res3 = confirmedResistances[2] || null;

      // ─────────────────────────────────────────────────────
      // STEP 7 — EXACT TURNING POINTS  ← UNCHANGED
      // ─────────────────────────────────────────────────────
      const bullTurnRaw = sup1 && sup2
        ? (sup1.strike * sup1.peVol + sup2.strike * sup2.peVol) / (sup1.peVol + sup2.peVol)
        : sup1?.preciseS || supportStrike;
      const bullTurn = snap(bullTurnRaw);

      const bearTurnRaw = res1 && res2
        ? (res1.strike * res1.ceVol + res2.strike * res2.ceVol) / (res1.ceVol + res2.ceVol)
        : res1?.preciseR || resistanceStrike;
      const bearTurn = snap(bearTurnRaw);

      // ─────────────────────────────────────────────────────
      // STEP 8 — TRADE SIGNAL  ← UNCHANGED
      // ─────────────────────────────────────────────────────
      const bullFloorBuilding = !!(sup1?.peBuilding);
      const bearCeilBuilding  = !!(res1?.ceBuilding);

      let tradeSignal = "WAIT ⚠️";
      let tradeColor  = "#fb923c";
      let tradeIcon   = "🟠";
      if (bullFloorBuilding && !bearCeilBuilding) {
        tradeSignal = "CALL LO 📈";  tradeColor = "#4ade80"; tradeIcon = "🟢";
      } else if (!bullFloorBuilding && bearCeilBuilding) {
        tradeSignal = "PUT LO 📉";   tradeColor = "#f87171"; tradeIcon = "🔴";
      } else if (bullFloorBuilding && bearCeilBuilding) {
        tradeSignal = "RANGE TRADE ↔"; tradeColor = "#fbbf24"; tradeIcon = "🟡";
      }

      // ─────────────────────────────────────────────────────
      // STEP 9 — SETS for row flagging
      // ─────────────────────────────────────────────────────
      const confirmedSupportStrikes    = new Set(confirmedSupports.map(x => x.strike));
      const confirmedResistanceStrikes = new Set(confirmedResistances.map(x => x.strike));

      // ─────────────────────────────────────────────────────
      // STEP 10 — COLOR CONSTANTS
      // ─────────────────────────────────────────────────────
      const DIM  = 0.13;
      const MED  = 0.28;
      const LOUD = 0.55;

      // ─────────────────────────────────────────────────────
      // STEP 11 — ROW RENDER  ← UNCHANGED
      // ─────────────────────────────────────────────────────
      return optionChain.map((row, idx) => {
        const strike  = safe(row.strikePrice);
        const rowSpot = safe(row.CE?.underlyingValue || row.PE?.underlyingValue);
        const ceOI    = safe(row.CE?.openInterest);
        const peOI    = safe(row.PE?.openInterest);
        const ceChg   = safe(row.CE?.changeinOpenInterest);
        const peChg   = safe(row.PE?.changeinOpenInterest);
        const ceVol   = safe(row.CE?.totalTradedVolume);
        const peVol   = safe(row.PE?.totalTradedVolume);
        const w       = weighted.find(x => x.strike === strike) || {};

        const isATM          = Math.abs(strike - rowSpot) <= 50;
        const isSupport      = strike === supportStrike;
        const isResistance   = strike === resistanceStrike;
        const isDriver       = strike === driverStrike;
        const isDriver2      = strike === driver2Strike;
        const isTarget       = strike === targetStrike;
        const isCeB1         = !!(ceB1 && strike === ceB1.strike);
        const isPeB1         = !!(peB1 && strike === peB1.strike);
        const isSup1         = !!(sup1 && strike === sup1.strike);
        const isSup2         = !!(sup2 && strike === sup2.strike && sup2.strike !== sup1?.strike);
        const isRes1         = !!(res1 && strike === res1.strike);
        const isRes2         = !!(res2 && strike === res2.strike && res2.strike !== res1?.strike);
        const isOtherConfS   = confirmedSupportStrikes.has(strike)
                               && !isSup1 && !isSup2 && !isPeB1 && !isSupport;
        const isOtherConfR   = confirmedResistanceStrikes.has(strike)
                               && !isRes1 && !isRes2 && !isCeB1 && !isResistance;

        const ml      = metricLeaders.find(d => d.strike === strike);
        const domSide = ml?.dominantSide || null;
        const hlCE    = domSide === "CE" && isDriver;
        const hlPE    = domSide === "PE" && isDriver;

        let rowBg = "#0f172a";
        if      (isTarget)      rowBg = "#431407";
        else if (isDriver)      rowBg = "#172554";
        else if (isDriver2)     rowBg = "#1e1b4b";
        else if (isResistance)  rowBg = "#3b0a0a";
        else if (isSupport)     rowBg = "#052e16";
        else if (isSup1)        rowBg = "#0a4a20";
        else if (isSup2)        rowBg = "#073518";
        else if (isRes1)        rowBg = "#4a0a10";
        else if (isRes2)        rowBg = "#380810";
        else if (isCeB1)        rowBg = "#350a0a";
        else if (isPeB1)        rowBg = "#042810";
        else if (isOtherConfS)  rowBg = "#021508";
        else if (isOtherConfR)  rowBg = "#150305";
        else if (isATM)         rowBg = "#1c1a07";

        const ceAlpha = isRes1 || isCeB1 ? LOUD
                       : isRes2 || isOtherConfR ? MED
                       : ceOI > 0 ? DIM : 0;
        const peAlpha = isSup1 || isPeB1 ? LOUD
                       : isSup2 || isOtherConfS ? MED
                       : peOI > 0 ? DIM : 0;

        const ceOiBg = hlCE ? "rgba(255,255,255,0.18)"
          : ceOI > 0
            ? (ceChg >= 0 ? `rgba(239,68,68,${ceAlpha})` : `rgba(249,115,22,${ceAlpha})`)
            : "transparent";

        const peOiBg = hlPE ? "rgba(255,255,255,0.18)"
          : peOI > 0
            ? (peChg >= 0 ? `rgba(34,197,94,${peAlpha})` : `rgba(234,179,8,${peAlpha})`)
            : "transparent";

        const ceChgBg = hlCE ? "rgba(255,255,255,0.12)"
          : ceChg > 0 ? `rgba(239,68,68,${DIM})`
          : ceChg < 0 ? `rgba(249,115,22,${DIM})`
          : "transparent";

        const peChgBg = hlPE ? "rgba(255,255,255,0.12)"
          : peChg > 0 ? `rgba(34,197,94,${DIM})`
          : peChg < 0 ? `rgba(234,179,8,${DIM})`
          : "transparent";

        const avgVol   = 200000;
        const ceVolBg  = hlCE ? "rgba(255,255,255,0.12)"
          : ceVol > avgVol * 2 ? `rgba(239,68,68,${MED})`
          : ceVol > avgVol     ? `rgba(239,68,68,${DIM})`
          : "transparent";

        const peVolBg  = hlPE ? "rgba(255,255,255,0.12)"
          : peVol > avgVol * 2 ? `rgba(34,197,94,${MED})`
          : peVol > avgVol     ? `rgba(34,197,94,${DIM})`
          : "transparent";

        const cellBase = { color: "#e2e8f0", padding: "3px 5px", fontSize: "11px" };

        let icon = "";
        if      (isTarget)     icon = marketDir==="UPSIDE"?" 🚀":marketDir==="DOWNSIDE"?" ⚡":" ⚪";
        else if (isDriver)     icon = domSide==="PE"?" 🔵":" 🟠";
        else if (isDriver2)    icon = " 🟣";
        else if (isResistance) icon = " 🟢";
        else if (isSupport)    icon = " 🔴";
        else if (isSup1)       icon = " 🐂";
        else if (isSup2)       icon = " 🔷";
        else if (isRes1)       icon = " 🐻";
        else if (isRes2)       icon = " 🔶";
        else if (isOtherConfS) icon = " ▼";
        else if (isOtherConfR) icon = " ▲";

        const preciseLabel =
          isResistance && preciseResistance !== resistanceStrike
            ? <div style={{fontSize:"9px",color:"#86efac"}}>exact ≈ {preciseResistance}</div>
          : isSupport && preciseSupport !== supportStrike
            ? <div style={{fontSize:"9px",color:"#fca5a5"}}>exact ≈ {preciseSupport}</div>
          : null;

        const supCard = (isSup1 || isSup2) && (sup1 || sup2) ? (() => {
          const sd    = isSup1 ? sup1 : sup2;
          const rank  = isSup1 ? 1 : 2;
          const ratio = sd.ceOI > 0 ? (sd.peOI / sd.ceOI).toFixed(1) : "∞";
          const brkC  = L(Math.round(sd.peOI * 0.30));
          return (
            <div style={{
              marginTop:"3px", padding:"5px 7px",
              background: rank===1 ? "rgba(34,197,94,0.18)" : "rgba(34,197,94,0.10)",
              border: `1px solid ${rank===1 ? "#22c55e" : "#4ade80"}`,
              borderRadius:"4px", lineHeight:"1.8", fontSize:"9px",
            }}>
              <div style={{color:"#4ade80", fontWeight:"bold", fontSize:"10px"}}>
                🐂 BULLISH TURNING POINT #{rank}
                {rank===1 &&
                  <span style={{color:"#fbbf24", marginLeft:"6px"}}>
                    EXACT TURN = {bullTurn}
                  </span>
                }
              </div>
              <div style={{color:"#bbf7d0"}}>
                PE OI: {L(sd.peOI)} &nbsp;|&nbsp;
                CE OI: {L(sd.ceOI)} &nbsp;|&nbsp;
                Ratio: <strong style={{color:"#4ade80"}}>{ratio}×</strong>
              </div>
              <div style={{color: sd.peBuilding ? "#4ade80" : "#fde047"}}>
                {sd.peBuilding
                  ? `▲ Aaj +${L(sd.peChg)} naye PE contracts bane → Floor MAZBOOT`
                  : `▼ Aaj ${L(sd.peChg)} PE contracts nikle → Floor KAMZOR`}
              </div>
              <div style={{color:"#86efac"}}>
                PE Vol: {L(sd.peVol)} &nbsp;|&nbsp; CE Vol: {L(sd.ceVol)}
                &nbsp;→&nbsp;
                <strong style={{color: sd.peVol>sd.ceVol ? "#4ade80" : "#f87171"}}>
                  {sd.peVol>sd.ceVol ? "PE Vol zyada ✅ BULLISH" : "CE Vol zyada ⚠️"}
                </strong>
              </div>
              <div style={{color:"#fbbf24", fontWeight:"bold"}}>
                Strength: {sd.supportTag}
              </div>
              <div style={{color:"#475569"}}>
                Tootne ke liye {brkC} contracts aur exit chahiye (30%)
                {sd.preciseS !== sd.strike
                  ? <span style={{color:"#fbbf24"}}> | Precise: {sd.preciseS}</span>
                  : null}
              </div>
              {rank===1 &&
                <div style={{
                  marginTop:"3px", padding:"3px 6px",
                  background:"rgba(250,204,21,0.12)", borderRadius:"3px",
                  color:"#fbbf24", fontWeight:"bold", fontSize:"9px",
                }}>
                  📌 {bullTurn} pe market ruke → CALL LO &nbsp;|&nbsp;
                  {bullTurn} toota → next support: {sup3?.strike || rangeLo}
                </div>
              }
            </div>
          );
        })() : null;

        const resCard = (isRes1 || isRes2) && (res1 || res2) ? (() => {
          const rd    = isRes1 ? res1 : res2;
          const rank  = isRes1 ? 1 : 2;
          const ratio = rd.peOI > 0 ? (rd.ceOI / rd.peOI).toFixed(1) : "∞";
          const brkC  = L(Math.round(rd.ceOI * 0.30));
          return (
            <div style={{
              marginTop:"3px", padding:"5px 7px",
              background: rank===1 ? "rgba(239,68,68,0.18)" : "rgba(239,68,68,0.10)",
              border: `1px solid ${rank===1 ? "#ef4444" : "#f87171"}`,
              borderRadius:"4px", lineHeight:"1.8", fontSize:"9px",
            }}>
              <div style={{color:"#f87171", fontWeight:"bold", fontSize:"10px"}}>
                🐻 BEARISH TURNING POINT #{rank}
                {rank===1 &&
                  <span style={{color:"#fbbf24", marginLeft:"6px"}}>
                    EXACT TURN = {bearTurn}
                  </span>
                }
              </div>
              <div style={{color:"#fda4af"}}>
                CE OI: {L(rd.ceOI)} &nbsp;|&nbsp;
                PE OI: {L(rd.peOI)} &nbsp;|&nbsp;
                Ratio: <strong style={{color:"#f87171"}}>{ratio}×</strong>
              </div>
              <div style={{color: rd.ceBuilding ? "#f87171" : "#fb923c"}}>
                {rd.ceBuilding
                  ? `▲ Aaj +${L(rd.ceChg)} naye CE contracts bane → Ceiling MAZBOOT`
                  : `▼ Aaj ${L(rd.ceChg)} CE contracts nikle → Ceiling KAMZOR`}
              </div>
              <div style={{color:"#fca5a5"}}>
                CE Vol: {L(rd.ceVol)} &nbsp;|&nbsp; PE Vol: {L(rd.peVol)}
                &nbsp;→&nbsp;
                <strong style={{color: rd.ceVol>rd.peVol ? "#f87171" : "#4ade80"}}>
                  {rd.ceVol>rd.peVol ? "CE Vol zyada ✅ BEARISH" : "PE Vol zyada ⚠️"}
                </strong>
              </div>
              <div style={{color:"#fbbf24", fontWeight:"bold"}}>
                Strength: {rd.resistTag}
              </div>
              <div style={{color:"#475569"}}>
                Tootne ke liye {brkC} contracts aur exit chahiye (30%)
                {rd.preciseR !== rd.strike
                  ? <span style={{color:"#fbbf24"}}> | Precise: {rd.preciseR}</span>
                  : null}
              </div>
              {rank===1 &&
                <div style={{
                  marginTop:"3px", padding:"3px 6px",
                  background:"rgba(250,204,21,0.12)", borderRadius:"3px",
                  color:"#fbbf24", fontWeight:"bold", fontSize:"9px",
                }}>
                  📌 {bearTurn} pe market ruke → PUT LO &nbsp;|&nbsp;
                  {bearTurn} toota → next resistance: {res3?.strike || rangeHi}
                </div>
              }
            </div>
          );
        })() : null;

        const confSNote = isOtherConfS ? (() => {
          const ratio = w.ceOI > 0 ? (w.peOI / w.ceOI).toFixed(1) : "∞";
          return (
            <div style={{
              marginTop:"2px", padding:"2px 6px",
              background:"rgba(34,197,94,0.08)",
              borderLeft:"2px solid #4ade80",
              borderRadius:"2px", fontSize:"9px", lineHeight:"1.5",
            }}>
              <span style={{color:"#86efac", fontWeight:"bold"}}>▼ S: PE {ratio}× &nbsp;</span>
              <span style={{color: w.peBuilding?"#86efac":"#fde047"}}>
                {w.peBuilding
                  ? `Mazboot 🔒 (${(w.peBreakLeft||0).toFixed(0)}% to break)`
                  : `Kamzor 🔓 (${(w.peBreakLeft||0).toFixed(0)}% aur ghate to toot)`}
              </span>
              {w.preciseS !== w.strike &&
                <span style={{color:"#fbbf24"}}> | exact≈{w.preciseS}</span>}
            </div>
          );
        })() : null;

        const confRNote = isOtherConfR ? (() => {
          const ratio = w.peOI > 0 ? (w.ceOI / w.peOI).toFixed(1) : "∞";
          return (
            <div style={{
              marginTop:"2px", padding:"2px 6px",
              background:"rgba(239,68,68,0.08)",
              borderLeft:"2px solid #f87171",
              borderRadius:"2px", fontSize:"9px", lineHeight:"1.5",
            }}>
              <span style={{color:"#fca5a5", fontWeight:"bold"}}>▲ R: CE {ratio}× &nbsp;</span>
              <span style={{color: w.ceBuilding?"#fca5a5":"#fb923c"}}>
                {w.ceBuilding
                  ? `Mazboot 🔒 (${(w.ceBreakLeft||0).toFixed(0)}% to break)`
                  : `Kamzor 🔓 (${(w.ceBreakLeft||0).toFixed(0)}% aur ghate to toot)`}
              </span>
              {w.preciseR !== w.strike &&
                <span style={{color:"#fbbf24"}}> | exact≈{w.preciseR}</span>}
            </div>
          );
        })() : null;

        const barrierNote = (isCeB1 || isPeB1) ? (
          <div style={{
            marginTop:"2px", padding:"3px 6px",
            background: isCeB1 ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.10)",
            borderLeft: `3px solid ${isCeB1 ? "#ef4444" : "#22c55e"}`,
            borderRadius:"3px", fontSize:"9px", lineHeight:"1.5",
          }}>
            {isCeB1 &&
              <span style={{color:"#fca5a5", fontWeight:"bold"}}>
                {ceDoubleWall ? "🧱 DOUBLE WALL" : "🎯 BADI RESISTANCE"}
                &nbsp;— CE OI {L(ceB1.ceOI)}
                &nbsp;|&nbsp;
                {ceB1.ceBuilding
                  ? `Mazboot 🔒 (${ceB1.ceBreakLeft.toFixed(0)}% to break)`
                  : `Kamzor 🔓`}
              </span>
            }
            {isPeB1 &&
              <span style={{color:"#86efac", fontWeight:"bold"}}>
                {peDoubleWall ? "🧱 DOUBLE FLOOR" : "🎯 BADA SUPPORT"}
                &nbsp;— PE OI {L(peB1.peOI)}
                &nbsp;|&nbsp;
                {peB1.peBuilding
                  ? `Mazboot 🔒 (${peB1.peBreakLeft.toFixed(0)}% to break)`
                  : `Kamzor 🔓`}
              </span>
            }
          </div>
        ) : null;

        const atmBox = isATM ? (
          <div style={{
            marginTop:"5px", padding:"6px 8px",
            background:"#080d1a",
            border:"1px solid rgba(250,204,21,0.30)",
            borderRadius:"5px", fontSize:"9px", lineHeight:"1.9",
          }}>
            <div style={{
              padding:"5px 10px", borderRadius:"4px", marginBottom:"5px",
              background: tradeColor==="#4ade80" ? "rgba(34,197,94,0.18)"
                : tradeColor==="#f87171" ? "rgba(239,68,68,0.18)"
                : tradeColor==="#fbbf24" ? "rgba(250,204,21,0.14)"
                : "rgba(251,146,60,0.14)",
              border:`1px solid ${tradeColor}`,
              textAlign:"center",
            }}>
              <div style={{color:tradeColor, fontWeight:"bold", fontSize:"13px"}}>
                {tradeIcon} &nbsp; {tradeSignal}
              </div>
            </div>

            <div style={{
              padding:"4px 7px", borderRadius:"4px", marginBottom:"4px",
              background:"rgba(34,197,94,0.10)",
              border:"1px solid rgba(34,197,94,0.35)",
            }}>
              <div style={{color:"#4ade80", fontWeight:"bold", fontSize:"10px", marginBottom:"2px"}}>
                🐂 BULLISH TURN = {bullTurn}
              </div>
              <div style={{color:"#94a3b8"}}>
                Primary: <span style={{color:"#4ade80",fontWeight:"bold"}}>{sup1?.strike||"—"}</span>
                &nbsp;PE OI {L(sup1?.peOI)} | {sup1?.supportTag||""}
              </div>
              <div style={{color:"#94a3b8"}}>
                Secondary: <span style={{color:"#86efac"}}>{sup2?.strike||"—"}</span>
                &nbsp;PE OI {L(sup2?.peOI)} | {sup2?.supportTag||""}
              </div>
              <div style={{color:"#64748b", fontSize:"8px"}}>
                Formula: ({sup1?.strike||0}×{L(sup1?.peVol)} + {sup2?.strike||0}×{L(sup2?.peVol)})
                &nbsp;÷ {L((sup1?.peVol||0)+(sup2?.peVol||0))} = {bullTurn}
              </div>
              <div style={{color:"#fbbf24", fontWeight:"bold", marginTop:"2px"}}>
                📌 {bullTurn} ruke → CALL LO &nbsp;|&nbsp;
                Toot jaye → next: {sup3?.strike || rangeLo}
              </div>
            </div>

            <div style={{
              padding:"4px 7px", borderRadius:"4px", marginBottom:"4px",
              background:"rgba(239,68,68,0.10)",
              border:"1px solid rgba(239,68,68,0.35)",
            }}>
              <div style={{color:"#f87171", fontWeight:"bold", fontSize:"10px", marginBottom:"2px"}}>
                🐻 BEARISH TURN = {bearTurn}
              </div>
              <div style={{color:"#94a3b8"}}>
                Primary: <span style={{color:"#f87171",fontWeight:"bold"}}>{res1?.strike||"—"}</span>
                &nbsp;CE OI {L(res1?.ceOI)} | {res1?.resistTag||""}
              </div>
              <div style={{color:"#94a3b8"}}>
                Secondary: <span style={{color:"#fca5a5"}}>{res2?.strike||"—"}</span>
                &nbsp;CE OI {L(res2?.ceOI)} | {res2?.resistTag||""}
              </div>
              <div style={{color:"#64748b", fontSize:"8px"}}>
                Formula: ({res1?.strike||0}×{L(res1?.ceVol)} + {res2?.strike||0}×{L(res2?.ceVol)})
                &nbsp;÷ {L((res1?.ceVol||0)+(res2?.ceVol||0))} = {bearTurn}
              </div>
              <div style={{color:"#fbbf24", fontWeight:"bold", marginTop:"2px"}}>
                📌 {bearTurn} ruke → PUT LO &nbsp;|&nbsp;
                Toot jaye → next: {res3?.strike || rangeHi}
              </div>
            </div>

            <div style={{
              borderTop:"1px solid rgba(255,255,255,0.06)",
              paddingTop:"3px", marginTop:"2px",
            }}>
              <span style={{color:"#fbbf24", fontWeight:"bold"}}>RANGE: </span>
              <span style={{color:"#86efac"}}>{rangeLo}</span>
              <span style={{color:"#64748b"}}> ↔ </span>
              <span style={{color:"#fca5a5"}}>{rangeHi}</span>
              <span style={{color:"#475569"}}> &nbsp;|&nbsp; </span>
              <span style={{color:"#94a3b8"}}>PCR {pcr.toFixed(2)} → {pcrLabel}</span>
            </div>

            {confirmedSupports.length > 0 &&
              <div style={{marginTop:"3px"}}>
                <span style={{color:"#4ade80", fontWeight:"bold"}}>S (confirmed): </span>
                {confirmedSupports.slice(0, 6).map((x, i) => (
                  <span key={i}>
                    <span style={{color: x.peBuilding?"#86efac":"#fde047", fontWeight:i<2?"bold":"normal"}}>
                      {x.strike}
                      {x.preciseS!==x.strike ? `(≈${x.preciseS})` : ""}
                      [{(x.peRatio||0).toFixed(0)}×{x.peBuilding?"🔒":"🔓"}]
                    </span>
                    {i < Math.min(confirmedSupports.length,6)-1 &&
                      <span style={{color:"#334155"}}> ← </span>}
                  </span>
                ))}
              </div>
            }

            {confirmedResistances.length > 0 &&
              <div style={{marginTop:"2px"}}>
                <span style={{color:"#f87171", fontWeight:"bold"}}>R (confirmed): </span>
                {confirmedResistances.slice(0, 5).map((x, i) => (
                  <span key={i}>
                    <span style={{color: x.ceBuilding?"#fca5a5":"#fb923c", fontWeight:i<2?"bold":"normal"}}>
                      {x.strike}
                      {x.preciseR!==x.strike ? `(≈${x.preciseR})` : ""}
                      [{(x.ceRatio||0).toFixed(0)}×{x.ceBuilding?"🔒":"🔓"}]
                    </span>
                    {i < Math.min(confirmedResistances.length,5)-1 &&
                      <span style={{color:"#334155"}}> → </span>}
                  </span>
                ))}
              </div>
            }
          </div>
        ) : null;

        return (
          <tr
            key={idx}
            style={{
              backgroundColor: rowBg,
              color: "#e2e8f0",
              fontWeight:
                isTarget||isDriver||isResistance||isSupport||isSup1||isRes1
                  ? "bold" : "normal",
            }}
          >
            <td style={{...cellBase, backgroundColor:ceOiBg, fontWeight:isRes1||isCeB1?"bold":"normal", border:hlCE?"1px solid rgba(255,255,255,0.25)":"none"}}>
              {ceOI || "-"}
              {ceOI > 0 && ceChg !== 0 &&
                <div style={{fontSize:"8px", color:ceChg>0?"#fca5a5":"#fdba74", lineHeight:"1"}}>
                  {ceChg>0?"▲":"▼"} {ceChg>0?"badh":"ghath"} raha
                </div>
              }
            </td>
            <td style={{...cellBase, backgroundColor:ceChgBg, color:ceChg>0?"#fca5a5":ceChg<0?"#fdba74":"#94a3b8"}}>
              {ceChg || "-"}
            </td>
            <td style={{...cellBase, color:"#cbd5e1"}}>
              {row.CE?.lastPrice ?? "-"}
            </td>
            <td style={{...cellBase, backgroundColor:ceVolBg}}>
              {ceVol || "-"}
            </td>
            <td style={{
              textAlign:"center", padding:"3px 6px",
              fontSize:"12px", minWidth:"130px", verticalAlign:"top",
            }}>
              <span style={{fontWeight:"bold", color:"#f1f5f9"}}>{strike}</span>
              {icon}
              {preciseLabel}
              {supCard}
              {resCard}
              {confSNote}
              {confRNote}
              {barrierNote}
              {atmBox}
            </td>
            <td style={{...cellBase, backgroundColor:peVolBg}}>
              {peVol || "-"}
            </td>
            <td style={{...cellBase, color:"#cbd5e1"}}>
              {row.PE?.lastPrice ?? "-"}
            </td>
            <td style={{...cellBase, backgroundColor:peChgBg, color:peChg>0?"#86efac":peChg<0?"#fde047":"#94a3b8"}}>
              {peChg || "-"}
            </td>
            <td style={{...cellBase, backgroundColor:peOiBg, fontWeight:isSup1||isPeB1?"bold":"normal", border:hlPE?"1px solid rgba(255,255,255,0.25)":"none"}}>
              {peOI || "-"}
              {peOI > 0 && peChg !== 0 &&
                <div style={{fontSize:"8px", color:peChg>0?"#86efac":"#fde047", lineHeight:"1"}}>
                  {peChg>0?"▲":"▼"} {peChg>0?"badh":"ghath"} raha
                </div>
              }
            </td>
          </tr>
        );
      });

    } catch (err) {
      return (
        <tr>
          <td colSpan="9" style={{
            backgroundColor:"#1a0a0a", color:"#f87171",
            padding:"16px", textAlign:"center", fontSize:"13px",
          }}>
            ⚠️ Error loading option chain: {err?.message || String(err)}
          </td>
        </tr>
      );
    }
  })()}
</tbody>
            </table>
        </div>
    );
};

export default OptionChainTable;