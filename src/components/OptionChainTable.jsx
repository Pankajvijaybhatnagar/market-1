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
                        const spot =
                            Number(
                                optionChain?.[0]?.CE?.underlyingValue ||
                                optionChain?.[0]?.PE?.underlyingValue ||
                                0
                            );

                        // Only round figure strikes like 25100, 25200, 25300...
                        const roundFigureRows = optionChain.filter((row) => {
                            const strike = Number(row.strikePrice);
                            return strike % 100 === 0;
                        });

                        // First nearest resistance above spot (round figure only)
                        const firstResistance = roundFigureRows.find((row) => {
                            const strike = Number(row.strikePrice);
                            const ceOI = Number(row.CE?.openInterest || 0);
                            const peOI = Number(row.PE?.openInterest || 0);

                            return strike >= spot && ceOI > 0 && peOI > 0 && ceOI >= peOI * 2;
                        });

                        // Last nearest support below spot (round figure only)
                        const supportCandidates = roundFigureRows.filter((row) => {
                            const strike = Number(row.strikePrice);
                            const ceOI = Number(row.CE?.openInterest || 0);
                            const peOI = Number(row.PE?.openInterest || 0);

                            return strike <= spot && peOI > 0 && ceOI > 0 && peOI >= ceOI * 2;
                        });

                        const lastSupport = supportCandidates[supportCandidates.length - 1];

                        const supportStrike = Number(lastSupport?.strikePrice || 0);
                        const resistanceStrike = Number(firstResistance?.strikePrice || 0);

                        return optionChain.map((row, index) => {
                            const strike = Number(row.strikePrice);
                            const rowSpot = Number(
                                row.CE?.underlyingValue || row.PE?.underlyingValue || 0
                            );

                            const ceOI = Number(row.CE?.openInterest || 0);
                            const peOI = Number(row.PE?.openInterest || 0);

                            const isATM = Math.abs(strike - rowSpot) <= 50;
                            const isSupport = strike === supportStrike;
                            const isResistance = strike === resistanceStrike;

                            let rowBg = "";
                            let rowColor = "#fff";

                            if (isResistance) {
                                rowBg = "#3b0a0a"; // round figure resistance
                            } else if (isSupport) {
                                rowBg = "#0b2e13"; // round figure support
                            } else if (isATM) {
                                rowBg = "#4a3b00"; // ATM
                            } else {
                                rowBg = "#111827"; // normal
                            }

                            return (
                                <tr
                                    key={index}
                                    style={{
                                        backgroundColor: rowBg,
                                        color: rowColor,
                                        fontWeight:
                                            isResistance || isSupport || isATM
                                                ? "bold"
                                                : "normal",
                                    }}
                                >
                                    <td>{ceOI}</td>
                                    <td>{row.CE?.changeinOpenInterest ?? "-"}</td>
                                    <td>{row.CE?.lastPrice ?? "-"}</td>
                                
                                    <td>{row.CE?.totalTradedVolume ?? "-"}</td>
                                    

                                    <td>
                                        {strike}
                                        {isResistance ? " 🟢" : isSupport ? " 🔴" : ""}
                                    </td>

                                    <td>{row.PE?.totalTradedVolume ?? "-"}</td>
                                    <td>{row.PE?.lastPrice ?? "-"}</td>
                                    <td>{row.PE?.changeinOpenInterest ?? "-"}</td>
                                    <td>{peOI}</td>
                                </tr>
                            );
                        });
                    })()}
                </tbody>
            </table>
        </div>
    );
};

export default OptionChainTable;