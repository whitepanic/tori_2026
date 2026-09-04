const init = () => {
    const inputs = {
        assetNum: document.getElementById('asset-input'),
        assetRange: document.getElementById('asset-slider'),
        periodNum: document.getElementById('period-input'),
        periodRange: document.getElementById('period-slider'),
        finalNum: document.getElementById('final-input'),
        finalRange: document.getElementById('final-slider'),
        yieldNum: document.getElementById('yield-input'),
        yieldRange: document.getElementById('yield-slider'),
        nisaNum: document.getElementById('nisa-input'),
        nisaRange: document.getElementById('nisa-slider'),
        birthdate: document.getElementById('birthdate-input'),
        pensionNum: document.getElementById('pension-input'),
        pensionRange: document.getElementById('pension-slider')
    };

    const summary = {
        asset: document.getElementById('summary-asset'),
        period: document.getElementById('summary-period'),
        final: document.getElementById('summary-final'),
        withdrawal: document.getElementById('summary-withdrawal')
    };

    const headers = {
        withdrawal: document.getElementById('header-result-withdrawal')
    };

    const toggleBtn = document.getElementById('toggle-settings-btn');
    const settingsPanel = document.getElementById('settings-panel');
    
    const toggleLogBtn = document.getElementById('toggle-log-btn');
    const logPanel = document.getElementById('log-panel');
    const logContent = document.getElementById('log-content');

    let withdrawalChart = null;

    const colors = {
        base: '#0056b3'
    };

    // 年齢計算
    const getBaseAge = () => {
        const birthDate = new Date(inputs.birthdate.value || '1982-07-28');
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    // LocalStorage 管理 (クッキーからの移行対応)
    const storage = {
        get: (key) => {
            try {
                const item = localStorage.getItem(key);
                if (item !== null && item !== undefined && item !== '') return item;
            } catch (e) {}
            // クッキーフォールバック
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${key}=`);
            if (parts.length === 2) return parts.pop().split(';').shift();
            return null;
        },
        set: (key, value) => {
            try {
                localStorage.setItem(key, value);
            } catch (e) {}
        }
    };

    const loadSettings = () => {
        const load = (key, numEl, rangeEl) => {
            const val = storage.get(key);
            if (val !== null && val !== undefined && val !== '') {
                numEl.value = val;
                rangeEl.value = val;
            } else {
                numEl.value = rangeEl.value;
            }
        };
        load('sim2_asset', inputs.assetNum, inputs.assetRange);
        load('sim2_period', inputs.periodNum, inputs.periodRange);
        load('sim2_final', inputs.finalNum, inputs.finalRange);
        load('sim2_yield', inputs.yieldNum, inputs.yieldRange);
        load('sim2_pension', inputs.pensionNum, inputs.pensionRange);
        load('sim2_nisa', inputs.nisaNum, inputs.nisaRange);

        const bd = storage.get('sim2_birthdate');
        if (bd) inputs.birthdate.value = bd;
    };

    const saveSettings = () => {
        storage.set('sim2_asset', inputs.assetNum.value);
        storage.set('sim2_period', inputs.periodNum.value);
        storage.set('sim2_final', inputs.finalNum.value);
        storage.set('sim2_yield', inputs.yieldNum.value);
        storage.set('sim2_pension', inputs.pensionNum.value);
        storage.set('sim2_nisa', inputs.nisaNum.value);
        storage.set('sim2_birthdate', inputs.birthdate.value);
    };

    // 年金現価係数 (Present Value Annuity Factor)
    const PVAF = (r, n) => {
        if (n <= 0) return 0;
        if (r === 0) return n;
        return (1 - Math.pow(1 + r, -n)) / r;
    };

    // 毎月の生活費計算 (最終金額逆算)
    const calculateMonthlyWithdrawal = (pv, annualRate, months, monthsPre60, pensionAmt, finalAmount) => {
        const r = (annualRate / 100) / 12;
        if (months <= 0) return 0;

        if (r === 0) {
            // pv - PMT * months + Pension * (months - monthsPre60) = finalAmount
            const pensionTotal = months > monthsPre60 ? pensionAmt * (months - monthsPre60) : 0;
            return (pv - finalAmount + pensionTotal) / months;
        }

        const pvafN = PVAF(r, months);
        let pvafPension = 0;
        if (months > monthsPre60) {
            pvafPension = PVAF(r, months - monthsPre60) * Math.pow(1 + r, -monthsPre60);
        }

        const pmt = (pv - finalAmount * Math.pow(1 + r, -months) + pensionAmt * pvafPension) / pvafN;
        return pmt;
    };

    const generateChartData = (pvMan, annualRate, pmtMan, monthsPre60, maxYears, pensionAmt) => {
        const data = [];
        const r = (annualRate / 100) / 12;
        let balance = pvMan;

        for (let year = 0; year <= maxYears; year++) {
            data.push(Math.max(0, balance / 10000));
            if (year === maxYears) break;
            
            for (let month = 0; month < 12; month++) {
                const totalMonthsPassed = year * 12 + month;
                let currentPmt = pmtMan;
                if (totalMonthsPassed >= monthsPre60) {
                    currentPmt = pmtMan - pensionAmt;
                }
                balance = balance * (1 + r) - currentPmt;
            }
        }
        return data;
    };

    const updateSimulation = () => {
        const assetOku = parseFloat(inputs.assetNum.value);
        const pv = assetOku * 10000; 
        
        const targetAge = parseInt(inputs.periodNum.value);
        const baseAge = getBaseAge();
        const periodYears = Math.max(1, targetAge - baseAge);
        const periodMonths = periodYears * 12;
        
        const finalAmount = parseFloat(inputs.finalNum.value);
        const baseRate = parseFloat(inputs.yieldNum.value);
        const pensionAmt = parseFloat(inputs.pensionNum.value) || 0;
        
        const monthsPre60 = Math.max(0, (60 - baseAge) * 12);

        // サマリーバーの更新
        summary.asset.textContent = assetOku.toFixed(1);
        summary.period.textContent = targetAge;
        summary.final.textContent = finalAmount.toLocaleString();
        document.getElementById('period-unit-span').textContent = `歳 (${periodYears}年)`;

        const formatRate = (rate) => Number(rate.toFixed(1)) + '%';

        // 20.315% 세금 공제 로직 (NISA 비과세 비율 반영)
        const applyTax = (pmtMan) => {
            if (pmtMan <= 0) return 0;
            const nisaLimitMan = parseFloat(inputs.nisaNum.value);
            const totalAssetMan = pv; // pv is in 万円
            const ratioNisa = Math.min(totalAssetMan, nisaLimitMan) / totalAssetMan;
            const ratioTaxable = Math.max(0, totalAssetMan - nisaLimitMan) / totalAssetMan;
            const taxRate = 0.20315;
            const afterTax = pmtMan * ratioNisa + pmtMan * ratioTaxable * (1 - taxRate);
            return Math.floor(afterTax);
        };

        const formatPmt = (pmtMan) => {
            if (pmtMan <= 0) return "0万円 (0万円)";
            return `${applyTax(pmtMan).toLocaleString()}万円 (${pmtMan.toLocaleString()}万円)`;
        };

        // 生活費計算 (+2% 刻み)
        const calcPmt = Math.floor(calculateMonthlyWithdrawal(pv, baseRate, periodMonths, monthsPre60, pensionAmt, finalAmount));
        const calcPmtP2 = Math.floor(calculateMonthlyWithdrawal(pv, baseRate + 2, periodMonths, monthsPre60, pensionAmt, finalAmount));
        const calcPmtP4 = Math.floor(calculateMonthlyWithdrawal(pv, baseRate + 4, periodMonths, monthsPre60, pensionAmt, finalAmount));

        const generateLog = (pmtMan) => {
            if (pmtMan <= 0) return "生活費が0万円のため、計算ログはありません。";
            const nisaLimitMan = parseFloat(inputs.nisaNum.value);
            const totalAssetMan = pv;
            const taxableAssetMan = Math.max(0, totalAssetMan - nisaLimitMan);
            const nisaAssetMan = Math.min(totalAssetMan, nisaLimitMan);
            
            const ratioNisa = nisaAssetMan / totalAssetMan;
            const ratioTaxable = taxableAssetMan / totalAssetMan;
            
            const taxRate = 0.20315;
            const pmtNisa = pmtMan * ratioNisa;
            const pmtTaxable = pmtMan * ratioTaxable;
            const taxAmount = pmtTaxable * taxRate;
            const afterTax = pmtNisa + (pmtTaxable - taxAmount);
            
            return `【毎月生活費(${formatRate(baseRate)}) 計算詳細】
・金融資産額: ${totalAssetMan.toLocaleString()}万円
・NISA設定額: ${nisaLimitMan.toLocaleString()}万円

[ 税引前 生活費の算出条件 ]
・目標期間: ${periodMonths}ヶ月 (${baseAge}歳 → ${targetAge}歳)
・最終金額: ${finalAmount.toLocaleString()}万円
・年利回り: ${baseRate}% (月利: ${((baseRate/100)/12 * 100).toFixed(3)}%)
・年金収入: ${pensionAmt}万円/月 (60歳以降、受給 ${Math.max(0, periodMonths - monthsPre60)}ヶ月)
・算出公式: [現在価値(PV)を用いた逆算]
  (金融資産 - 最終金額の現在価値 + 年金の現在価値) ÷ 年金現価係数(${periodMonths}ヶ月)
・税引前 生活費: ${pmtMan.toLocaleString()}万円

[ 資産割合 (非課税 / 課税) ]
・非課税対象: ${nisaAssetMan.toLocaleString()}万円 (${(ratioNisa * 100).toFixed(2)}%)
・課税対象  : ${taxableAssetMan.toLocaleString()}万円 (${(ratioTaxable * 100).toFixed(2)}%)

[ 税金計算プロセス ]
・非課税 該当分: ${pmtNisa.toFixed(2)}万円
・課税 該当分  : ${pmtTaxable.toFixed(2)}万円
・控除税額(20.315%): -${taxAmount.toFixed(2)}万円

[ 最終生活費 (税引後) ]
・計算式: ${pmtNisa.toFixed(2)} + (${pmtTaxable.toFixed(2)} - ${taxAmount.toFixed(2)})
・税引後 生活費: ${Math.floor(afterTax).toLocaleString()}万円`;
        };
        
        logContent.textContent = generateLog(calcPmt);

        summary.withdrawal.textContent = formatPmt(calcPmt);
        
        const extraText = `
            <span class="header-result-extra">
                / ${formatRate(baseRate + 2)}: ${formatPmt(calcPmtP2)} 
                / ${formatRate(baseRate + 4)}: ${formatPmt(calcPmtP4)}
            </span>
        `;
        headers.withdrawal.innerHTML = `${formatRate(baseRate)}: ${formatPmt(calcPmt)} ${extraText}`;
        
        // グラフ用データ作成
        const chartData = generateChartData(pv, baseRate, calcPmt, monthsPre60, periodYears, pensionAmt);
        const categories = Array.from({length: periodYears + 1}, (_, i) => `${baseAge + i}歳`);

        // Y軸の範囲設定 (最小値: 最終残高 - 1,000万円, 最大値: 金融資産額 + 1,000万円)
        const yMin = Math.max(0, Number(((finalAmount - 1000) / 10000).toFixed(2)));
        let yMax = Number((assetOku + 0.1).toFixed(2));
        if (yMax <= yMin) yMax = yMin + 0.1;

        const yaxisConfig = {
            min: yMin,
            max: yMax,
            labels: {
                formatter: (val) => (val !== null && val !== undefined) ? val.toFixed(2) + '億' : '',
                style: { colors: '#666' }
            }
        };

        // 60歳 年金開始 イベントのアノテーション設定
        const annotationsConfig = {
            xaxis: []
        };
        if (baseAge <= 60 && targetAge >= 60) {
            annotationsConfig.xaxis.push({
                x: '60歳',
                borderColor: '#e03131',
                strokeDashArray: 4,
                label: {
                    borderColor: '#e03131',
                    style: {
                        color: '#fff',
                        background: '#e03131',
                        fontSize: '11px',
                        fontWeight: 600
                    },
                    text: '年金開始 (60歳)'
                }
            });
        }

        // ApexCharts 更新
        if (withdrawalChart) {
            withdrawalChart.updateSeries([{
                name: '資産残高',
                data: chartData
            }]);
            withdrawalChart.updateOptions({
                xaxis: { categories: categories },
                yaxis: yaxisConfig,
                annotations: annotationsConfig
            });
        } else {
            const options = {
                series: [{
                    name: '資産残高',
                    data: chartData
                }],
                chart: {
                    type: 'area',
                    height: '100%',
                    toolbar: { show: false },
                    animations: { enabled: false },
                    zoom: { enabled: false }
                },
                annotations: annotationsConfig,
                colors: [colors.base],
                dataLabels: { enabled: false },
                stroke: { curve: 'smooth', width: 2 },
                fill: {
                    type: 'gradient',
                    gradient: {
                        shadeIntensity: 1,
                        opacityFrom: 0.4,
                        opacityTo: 0.05,
                        stops: [0, 100]
                    }
                },
                xaxis: {
                    categories: categories,
                    tickAmount: Math.min(10, periodYears),
                    labels: { style: { colors: '#666' } }
                },
                yaxis: yaxisConfig,
                tooltip: {
                    y: { formatter: (val) => val.toFixed(2) + '億円' }
                }
            };
            withdrawalChart = new ApexCharts(document.querySelector("#chart-withdrawal"), options);
            withdrawalChart.render();
        }

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
    setupSync(inputs.finalNum, inputs.finalRange);
    setupSync(inputs.yieldNum, inputs.yieldRange);
    setupSync(inputs.pensionNum, inputs.pensionRange);
    setupSync(inputs.nisaNum, inputs.nisaRange);
    
    inputs.birthdate.addEventListener('change', updateSimulation);

    toggleBtn.addEventListener('click', () => {
        if (settingsPanel.classList.contains('hidden')) {
            settingsPanel.classList.remove('hidden');
            toggleBtn.textContent = '設定隠し';
        } else {
            settingsPanel.classList.add('hidden');
            toggleBtn.textContent = '設定変更';
        }
    });

    toggleLogBtn.addEventListener('click', () => {
        if (logPanel.classList.contains('hidden')) {
            logPanel.classList.remove('hidden');
            toggleLogBtn.textContent = 'ログ隠し';
        } else {
            logPanel.classList.add('hidden');
            toggleLogBtn.textContent = 'ログ表示';
        }
    });

    loadSettings();
    updateSimulation();
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
