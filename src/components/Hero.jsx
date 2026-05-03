import React, { useEffect, useState } from "react";
import OptionChainService from "../services/optionchainServices";
import OptionChainFilters from "./OptionChainFilters";
import OptionChainTable from "./OptionChainTable";

const Hero = () => {
    const [filters, setFilters] = useState({
        type: "Indices",
        symbol: "NIFTY",
        expiry: "30-Apr-2026",
    });

    const [expiryDates, setExpiryDates] = useState([]);
    const [optionChain, setOptionChain] = useState([]);
    const [loading, setLoading] = useState(false);

    const typeOptions = ["Indices", "Stocks"];

    const symbolOptions = {
        Indices: ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY"],
        Stocks: ["RELIANCE", "SBIN", "TCS", "INFY", "HDFCBANK"],
    };

    const updateFilters = (key, value) => {
        setFilters((prev) => ({
            ...prev,
            [key]: value,
        }));
    };

    const loadExpiryDates = async (updatedFilters) => {
        try {
            const dates = await OptionChainService.fetchExpiryDates(updatedFilters);

            setExpiryDates(dates || []);

            if (dates?.length) {
                setFilters((prev) => ({
                    ...prev,
                    expiry: dates[0],
                }));
            }
        } catch (error) {
            console.error("Error loading expiry dates:", error);
        }
    };

    const loadOptionChain = async (updatedFilters = filters) => {
        try {
            setLoading(true);

            const data = await OptionChainService.fetchFormattedOptionChain(
                updatedFilters
            );

            setOptionChain(data || []);
        } catch (error) {
            console.error("Error loading option chain:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleTypeChange = (e) => {
        const nextType = e.target.value;
        const nextSymbol = symbolOptions[nextType][0];

        setFilters({
            type: nextType,
            symbol: nextSymbol,
            expiry: "30-Apr-2026",
        });
    };

    const handleSymbolChange = (e) => {
        setFilters((prev) => ({
            ...prev,
            symbol: e.target.value,
            expiry: "30-Apr-2026",
        }));
    };

    const handleExpiryChange = (e) => {
        updateFilters("expiry", e.target.value);
    };

    useEffect(() => {
        loadExpiryDates(filters);
    }, [filters.type, filters.symbol]);

    useEffect(() => {
        if (filters.expiry) {
            loadOptionChain(filters);
        }
    }, [filters.expiry]);

    return (
        <div style={{ padding: "20px" }}>
            <h2>Option Chain Dashboard</h2>

            <OptionChainFilters
                filters={filters}
                expiryDates={expiryDates}
                typeOptions={typeOptions}
                symbolOptions={symbolOptions}
                onTypeChange={handleTypeChange}
                onSymbolChange={handleSymbolChange}
                onExpiryChange={handleExpiryChange}
                onRefresh={() => loadOptionChain(filters)}
            />

            <OptionChainTable loading={loading} optionChain={optionChain} />
        </div>
    );
};

export default Hero;