document.addEventListener('DOMContentLoaded', () => {
    const inputs = {
        assetNum: document.getElementById('asset-input'),
        assetRange: document.getElementById('asset-slider'),
        periodNum: document.getElementById('period-input'),
        periodRange: document.getElementById('period-slider'),
        withdrawalNum: document.getElementById('withdrawal-input'),
        withdrawalRange: document.getElementById('withdrawal-slider'),
        yieldNum: document.getElementById('yield-input'),
        yieldRange: document.getElementById('yield-slider')
    };

    const summary = {
        asset: document.getElementById('summary-asset'),
        yield: document.getElementById('summary-yield'),
        withdrawal: document.getElementById('summary-withdrawal'),
        period: document.getElementById('summary-period')
    };

    const headers = {
        yield: document.getElementById('header-result-yield'),
        withdrawal: document.getElementById('header-result-withdrawal'),
        period: document.getElementById('header-result-period')
    };

    const chartCtxs = {
        yield: document.getElementById('chart-yield').getContext('2d'),
        withdrawal: document.getElementById('chart-withdrawal').getContext('2d'),
        period: document.getElementById('chart-period').getContext('2d')
    };

    let charts = {
        yield: null,
        withdrawal: null,
        period: null
    };

    const colors = {
        base: 'rgba(0, 86, 179, 1)',
        p1: 'rgba(40, 167, 69, 1)',
        p2: 'rgba(255, 193, 7, 1)',
        p3: 'rgba(220, 53, 69, 1)'
    };

    // チャートX軸のステップサイズロジック
    const getStepSize = (maxYears) => {
        if (maxYears <= 8) return 1;
        if (maxYears <= 18) return 2;
        if (maxYears <= 28) return 3;
        if (maxYears <= 38) return 5;
        return 6;
    };

    // 共通のチャート設定
    const commonChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        plugins: {
            legend: { 
                display: true, 
                position: 'top',
                labels: { boxWidth: 12 }
            },
            tooltip: {
                callbacks: {
                    title: function(context) {
                        const year = Number(context[0].parsed.x);
                        return year + '年経過時 (' + (44 + year) + '歳)';
                    },
                    label: function(context) {
                        return context.dataset.label + ' : ' + context.parsed.y.toFixed(2) + ' 億円';
                    }
                }
            }
        },
        scales: {
            x: {
                title: { display: false },
                grid: { display: false },
                ticks: {
                    // stepSize は updateChart 時に動的設定
                }
            },
            y: {
                title: { display: false },
                grid: { display: false },
                min: 0
            }
        }
    };

    const getCookie = (name) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    };
    const setCookie = (name, value) => {
        document.cookie = `${name}=${value}; max-age=${60 * 60 * 24 * 365}; path=/`;
    };

    const loadSettings = () => {
        const asset = getCookie('sim_asset_oku');
        if (asset) {
            inputs.assetNum.value = asset;
            inputs.assetRange.value = asset;
        } else {
            inputs.assetNum.value = inputs.assetRange.value;
        }

        const withdrawal = getCookie('sim_withdrawal');
        if (withdrawal) {
            inputs.withdrawalNum.value = withdrawal;
            inputs.withdrawalRange.value = withdrawal;
        } else {
            inputs.withdrawalNum.value = inputs.withdrawalRange.value;
        }

        const period = getCookie('sim_period');
        if (period) {
            inputs.periodNum.value = period;
            inputs.periodRange.value = period;
        } else {
            inputs.periodNum.value = inputs.periodRange.value;
        }

        const yieldVal = getCookie('sim_yield');
        if (yieldVal) {
            inputs.yieldNum.value = yieldVal;
            inputs.yieldRange.value = yieldVal;
        } else {
            inputs.yieldNum.value = inputs.yieldRange.value;
        }
    };

    const saveSettings = () => {
        setCookie('sim_asset_oku', inputs.assetNum.value);
        setCookie('sim_withdrawal', inputs.withdrawalNum.value);
        setCookie('sim_period', inputs.periodNum.value);
        setCookie('sim_yield', inputs.yieldNum.value);
    };

    const calculateRequiredYield = (pv, pmt, months) => {
        if (pv >= pmt * months) return 0.0; // 자산이 인출 총액보다 크거나 같으면 이자율 0%로도 충분함
        let low = 0.0;
        let high = 1.0; 
        let mid = 0.0;
        for (let i = 0; i < 100; i++) {
            mid = (low + high) / 2;
            const r = mid / 12;
            const calculatedPv = (pmt / r) * (1 - Math.pow(1 + r, -months));
            if (Math.abs(calculatedPv - pv) < 0.00001) break;
            
            if (calculatedPv > pv) {
                low = mid; 
            } else {
                high = mid;
            }
        }
        return (mid * 100);
    };

    const calculateMonthlyWithdrawal = (pv, annualRate, months) => {
        if (annualRate <= 0) return (pv / months);
        const r = (annualRate / 100) / 12;
        return (pv * r) / (1 - Math.pow(1 + r, -months));
    };

    const calculateWithdrawalPeriod = (pv, annualRate, pmt) => {
        if (annualRate <= 0) return (pv / pmt / 12);
        const r = (annualRate / 100) / 12;
        if (pv * r >= pmt) return -1;
        const months = -Math.log(1 - (pv * r) / pmt) / Math.log(1 + r);
        return months / 12;
    };

    const generateChartDataset = (pvMan, annualRate, pmtMan, maxYears, label, color) => {
        const data = [];
        const r = (annualRate / 100) / 12;
        let balance = pvMan;

        for (let year = 0; year <= maxYears; year++) {
            data.push(Math.max(0, balance / 10000));
            if (balance <= 0) break;
            for (let m = 0; m < 12; m++) {
                if (balance <= 0) break;
                balance = balance * (1 + r) - pmtMan;
            }
        }
        return {
            label: label,
            data: data,
            borderColor: color,
            backgroundColor: color.replace('1)', '0.1)'),
            borderWidth: 2,
            fill: false,
            tension: 0.1,
            pointRadius: 0,
            pointHoverRadius: 6
        };
    };

    const updateChart = (type, labels, datasets, maxYears) => {
        if (charts[type]) {
            charts[type].destroy();
        }
        const isYield = (type === 'yield');
        const options = JSON.parse(JSON.stringify(commonChartOptions));
        
        // コールバックは復元
        options.plugins.tooltip.callbacks = commonChartOptions.plugins.tooltip.callbacks;

        if (isYield) {
            options.plugins.legend.display = false;
        }

        // Category 스케일에서는 stepSize가 동작하지 않으므로 callback을 통해 수동으로 간격 조절
        const step = getStepSize(maxYears);
        options.scales.x.ticks.callback = function(value) {
            const year = Number(this.getLabelForValue(value));
            if (year === 0) return year + '年';
            return (year % step === 0) ? year + '年' : null;
        };
        
        options.scales.y.ticks = {
            callback: function(value) {
                if (window.innerWidth <= 460) {
                    return value;
                }
                return value + '億';
            }
        };

        charts[type] = new Chart(chartCtxs[type], {
            type: 'line',
            data: { labels: labels, datasets: datasets },
            options: options
        });
    };

    const getLabels = (maxYears) => {
        const labels = [];
        for (let i = 0; i <= maxYears; i++) labels.push(i);
        return labels;
    };

    const updateSimulation = () => {
        const assetOku = parseFloat(inputs.assetNum.value);
        const pv = assetOku * 10000; 
        
        const periodYears = parseFloat(inputs.periodNum.value);
        const periodMonths = periodYears * 12;
        
        const pmt = parseFloat(inputs.withdrawalNum.value);
        const baseRate = parseFloat(inputs.yieldNum.value);

        // 年齢ラベル更新
        const p = parseInt(inputs.periodNum.value) || 35;
        document.getElementById('period-unit-span').textContent = `年 (${44 + p}歳)`;

        // サマリーバーの更新 (資産)
        summary.asset.textContent = assetOku.toFixed(1);

        // 1. 利回り計算
        const reqYield = calculateRequiredYield(pv, pmt, periodMonths);
        const reqYieldText = reqYield >= 100 ? '測定不能' : reqYield.toFixed(1);
        
        summary.yield.textContent = reqYieldText;
        headers.yield.innerHTML = `${reqYieldText}%`;
        
        const chartDataYieldYears = reqYield >= 100 ? 10 : periodYears;
        const dsYield = generateChartDataset(pv, reqYield >= 100 ? 0 : reqYield, pmt, chartDataYieldYears, '必要利回り', colors.base);
        dsYield.fill = true;
        updateChart('yield', getLabels(chartDataYieldYears), [dsYield], chartDataYieldYears);

        // 2. 毎月取り崩し額
        const calcPmt = Math.floor(calculateMonthlyWithdrawal(pv, baseRate, periodMonths));
        const calcPmtP1 = Math.floor(calculateMonthlyWithdrawal(pv, baseRate + 1, periodMonths));
        const calcPmtP2 = Math.floor(calculateMonthlyWithdrawal(pv, baseRate + 2, periodMonths));
        const calcPmtP3 = Math.floor(calculateMonthlyWithdrawal(pv, baseRate + 3, periodMonths));

        summary.withdrawal.textContent = calcPmt.toLocaleString();
        headers.withdrawal.innerHTML = `${calcPmt.toLocaleString()}万円 <span class="header-result-extra">/ <span style="color:${colors.p1}">+1%: ${calcPmtP1.toLocaleString()}万円</span> / <span style="color:${colors.p2}">+2%: ${calcPmtP2.toLocaleString()}万円</span> / <span style="color:${colors.p3}">+3%: ${calcPmtP3.toLocaleString()}万円</span></span>`;
        
        const dsWithdrawalBase = generateChartDataset(pv, baseRate, calcPmt, periodYears, `基準 (${baseRate.toFixed(1)}%)`, colors.base);
        dsWithdrawalBase.fill = true;
        const dsWithdrawalPlus1 = generateChartDataset(pv, baseRate + 1, calcPmtP1, periodYears, `+1% (${(baseRate + 1).toFixed(1)}%)`, colors.p1);
        const dsWithdrawalPlus2 = generateChartDataset(pv, baseRate + 2, calcPmtP2, periodYears, `+2% (${(baseRate + 2).toFixed(1)}%)`, colors.p2);
        const dsWithdrawalPlus3 = generateChartDataset(pv, baseRate + 3, calcPmtP3, periodYears, `+3% (${(baseRate + 3).toFixed(1)}%)`, colors.p3);
        
        updateChart('withdrawal', getLabels(periodYears), [dsWithdrawalBase, dsWithdrawalPlus1, dsWithdrawalPlus2, dsWithdrawalPlus3], periodYears);

        // 3. 取り崩し期間
        const calcPeriod = calculateWithdrawalPeriod(pv, baseRate, pmt);
        const calcPeriodP1 = calculateWithdrawalPeriod(pv, baseRate + 1, pmt);
        const calcPeriodP2 = calculateWithdrawalPeriod(pv, baseRate + 2, pmt);
        const calcPeriodP3 = calculateWithdrawalPeriod(pv, baseRate + 3, pmt);

        const formatPeriod = (p) => p === -1 ? '∞' : p.toFixed(1) + `年 (${Math.floor(44 + p)}歳)`;
        
        summary.period.textContent = calcPeriod === -1 ? '∞' : calcPeriod.toFixed(1);
        
        headers.period.innerHTML = `${formatPeriod(calcPeriod)} <span class="header-result-extra">/ <span style="color:${colors.p1}">+1%: ${formatPeriod(calcPeriodP1)}</span> / <span style="color:${colors.p2}">+2%: ${formatPeriod(calcPeriodP2)}</span> / <span style="color:${colors.p3}">+3%: ${formatPeriod(calcPeriodP3)}</span></span>`;
        
        let chartMaxYears = 0;
        const allPeriods = [calcPeriod, calcPeriodP1, calcPeriodP2, calcPeriodP3];
        const validPeriods = allPeriods.filter(p => p !== -1);
        if (validPeriods.length > 0) {
            chartMaxYears = Math.ceil(Math.max(...validPeriods));
        }
        if (allPeriods.includes(-1)) {
            chartMaxYears = Math.max(chartMaxYears, 50);
        }

        const dsPeriodBase = generateChartDataset(pv, baseRate, pmt, chartMaxYears, `基準 (${baseRate.toFixed(1)}%)`, colors.base);
        dsPeriodBase.fill = true;
        const dsPeriodPlus1 = generateChartDataset(pv, baseRate + 1, pmt, chartMaxYears, `+1% (${(baseRate + 1).toFixed(1)}%)`, colors.p1);
        const dsPeriodPlus2 = generateChartDataset(pv, baseRate + 2, pmt, chartMaxYears, `+2% (${(baseRate + 2).toFixed(1)}%)`, colors.p2);
        const dsPeriodPlus3 = generateChartDataset(pv, baseRate + 3, pmt, chartMaxYears, `+3% (${(baseRate + 3).toFixed(1)}%)`, colors.p3);

        updateChart('period', getLabels(chartMaxYears), [dsPeriodBase, dsPeriodPlus1, dsPeriodPlus2, dsPeriodPlus3], chartMaxYears);

        saveSettings();
    };

    const setupSync = (numInput, rangeInput) => {
        numInput.addEventListener('input', () => {
            let val = parseFloat(numInput.value);
            const min = parseFloat(numInput.min);
            const max = parseFloat(numInput.max);
            if (val < min) val = min;
            if (val > max) val = max;
            rangeInput.value = val;
            updateSimulation();
        });
        rangeInput.addEventListener('input', () => {
            numInput.value = rangeInput.value;
            updateSimulation();
        });
    };

    setupSync(inputs.assetNum, inputs.assetRange);
    setupSync(inputs.periodNum, inputs.periodRange);
    setupSync(inputs.withdrawalNum, inputs.withdrawalRange);
    setupSync(inputs.yieldNum, inputs.yieldRange);

    loadSettings();
    updateSimulation();
});
