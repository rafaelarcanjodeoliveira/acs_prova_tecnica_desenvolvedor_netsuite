/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/email', 'N/runtime', 'N/render'], (search, email, runtime, render) => {

    const PARAM_SENDER = 'custscript_r3_sender';
    const PARAM_TEMPLATE_ID = 'custscript_r3_template_file';

    function getInputData() {
        return search.create({
            type: "vendorbill",
            settings: [{ "name": "consolidationtype", "value": "ACCTTYPE" }, { "name": "includeperiodendtransactions", "value": "F" }],
            filters:
                [
                    ["type", "anyof", "VendBill"],
                    "AND",
                    ["status", "anyof", "VendBill:B"],
                    "AND",
                    ["trandate", "within", "lastmonth"],
                    "AND",
                    ["mainline", "is", "T"]
                ],
            columns:
                [
                    search.createColumn({ name: "total", label: "Valor (total da transação)" }),
                    search.createColumn({ name: "memo", label: "Memo" }),
                    search.createColumn({ name: "refnumber", label: "Número de referência" }),
                    search.createColumn({ name: "entity", label: "Nome" }),
                    search.createColumn({ name: "location", label: "Localidade" })
                ]
        })
    }

    function map(scriptContext) {
        const row = JSON.parse(scriptContext.value);
        const key = `${row.values.entity.value}|${row.values.location.value || 'NONE'}`;
        const value = {
            total: parseFloat(row.values.total || 0) || 0,
            memo: row.values.memo || '',
            entity: row.values.entity.text || '',
            location: row.values.location.text || '',
            refnumber: row.values.refnumber || row.id,
        };
        scriptContext.write(key, value);
    }

    function reduce(scriptContext) {
        const [vendorId] = scriptContext.key.split('|');
        
        let sum = 0;
        const rows = [];
        let vendorName = '';
        let locationName = '';

        scriptContext.values.forEach(json => {
            const it = JSON.parse(json);
            if (!vendorName) vendorName = it.entity || '';
            if (!locationName) locationName = it.location || 'Sem Localidade';

            sum += toNumber(it.total);
            rows.push(
                `<tr>
                <td>${safe(it.refnumber)}</td>
                <td>${safe(it.memo)}</td>
                <td style="text-align:right">${formatBR(sumNumber(it.total))}</td>
                </tr>`
            );
        });
        
        const rowsHtml = rows.join('');
        const totalFmt = formatBR(sum);
        const script = runtime.getCurrentScript();
        const sender   = Number(script.getParameter({ name: PARAM_SENDER })) || -5;
        const tplId    = Number(script.getParameter({ name: PARAM_TEMPLATE_ID }));

        const mergeResult = render.mergeEmail({
            templateId: tplId,  
            entity:    { type: 'vendor', id: Number(vendorId) },
            recipient: { type: 'vendor', id: Number(vendorId) }
        });

        const body = mergeResult.body
        .replace(/{{vendorName}}/g, vendorName)
        .replace(/{{locationName}}/g, locationName)
        .replace(/{{rows}}/g, rowsHtml)
        .replace(/{{total}}/g, totalFmt);

        const subject = mergeResult.subject

        if (vendorId) {
            email.send({
                author: sender,
                recipients: vendorId,
                subject: subject,
                body: body
            });
        }
    }

    function summarize({ inputSummary, mapSummary, reduceSummary }) {
        if (inputSummary.error) {
            log.error({ title: 'Input Error', details: inputSummary.error });
        }
        mapSummary.errors.iterator().each((key, error) => {
            log.error({ title: `Map Error [${key}]`, details: error });
            return true;
        });
        reduceSummary.errors.iterator().each((key, error) => {
            log.error({ title: `Reduce Error [${key}]`, details: error });
            return true;
        });
    }
    
    const safe = (s='') => String(s).replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));
    
    const toNumber = (n) => {
        const x = typeof n === 'number' ? n : parseFloat(n);
        return Number.isFinite(x) ? x : 0;
    };

    const sumNumber = (n) => toNumber(n);

    const formatBR = (n) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return { getInputData, map, reduce, summarize };
});
