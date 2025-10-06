/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 *
 */
define(['N/ui/serverWidget', 'N/search', 'N/record', 'N/runtime', 'N/redirect'],
    (serverWidget, search, record, runtime, redirect) => {

        const REC_ID = 'customrecord_tst_aprovacao';
        const LIST_ID = 'customlist_tst_status_aprovacao';
        const FLD_STATUS = 'custrecord_apr_status';
        const FLD_DESC = 'custrecord_apr_desc';

        const SUB_ID = 'custpage_sublist';
        const FLD_MARK = 'custpage_mark';
        const FLD_ID = 'custpage_id';
        const FLD_ST = 'custpage_status';
        const FLD_DS = 'custpage_desc';
        const HID_IDS = 'custpage_loaded_ids';

        const MAX_ROWS = 100;

        const json = (v) => JSON.stringify(v || []);
        const parseJson = (s) => { try { return JSON.parse(s || '[]'); } catch (_) { return []; } };

        function onRequest(ctx) {
            if (ctx.request.method === 'GET') renderGet(ctx);
            else processPost(ctx);
        }

        // ===== GET: lista até 100 registros pendentes =====
        function renderGet(ctx) {
            const { pending } = getStatusIds();
            const form = serverWidget.createForm({ title: 'Aprovação de Registros' });

            // Sublist apenas com checkbox editável
            const sub = form.addSublist({
                id: SUB_ID,
                type: serverWidget.SublistType.LIST,
                label: 'Pendentes'
            });
            
            sub.addField({ id: FLD_MARK, type: serverWidget.FieldType.CHECKBOX, label: 'Marcar' });
            sub.addField({ id: FLD_ID, type: serverWidget.FieldType.TEXT, label: 'ID' })
                .updateDisplayType({ displayType: serverWidget.FieldDisplayType.INLINE });
            sub.addField({ id: FLD_ST, type: serverWidget.FieldType.SELECT, label: 'Status', source: LIST_ID })
                .updateDisplayType({ displayType: serverWidget.FieldDisplayType.INLINE });
            sub.addField({ id: FLD_DS, type: serverWidget.FieldType.TEXT, label: 'Descrição' })
                .updateDisplayType({ displayType: serverWidget.FieldDisplayType.INLINE });

            const results = search.create({
                type: REC_ID,
                filters: [[FLD_STATUS, 'is', pending]],
                columns: ['internalid', FLD_STATUS, FLD_DESC]
            }).run().getRange({ start: 0, end: MAX_ROWS });

            const loadedIds = [];
            (results || []).forEach((r, i) => {
                const id = r.getValue({ name: 'internalid' });
                const st = r.getValue({ name: FLD_STATUS }) || '';
                const dsc = r.getValue({ name: FLD_DESC }) || '';

                if (id != null) {
                    sub.setSublistValue({ id: FLD_ID, line: i, value: String(id) });
                    sub.setSublistValue({ id: FLD_ST, line: i, value: String(st) });
                    if (dsc) sub.setSublistValue({ id: FLD_DS, line: i, value: dsc });
                    loadedIds.push(String(id));
                }
            });

            // Hidden com os IDs carregados (para saber quem NÃO foi marcado)
            const hid = form.addField({ id: HID_IDS, type: serverWidget.FieldType.LONGTEXT, label: 'loaded_ids' });
            hid.defaultValue = json(loadedIds);
            hid.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });
            
            sub.addMarkAllButtons()
            form.addSubmitButton({ label: 'Enviar Aprovação' });
            ctx.response.writePage(form);
        }

        // ===== POST: aprova marcados, rejeita não marcados (apenas quem ainda estiver pendente) =====
        function processPost(ctx) {
            const req = ctx.request;
            const { pending, approved, rejected } = getStatusIds();
            const lineCount = req.getLineCount({ group: SUB_ID }) || 0;

            const loadedIds = parseJson(req.parameters[HID_IDS]);
            if (!loadedIds.length) return refresh(); // nada carregado

            // Coleta marcados
            const selected = new Set();
            for (let i = 0; i < lineCount; i++) {
                const marked = req.getSublistValue({ group: SUB_ID, name: FLD_MARK, line: i }) === 'T';
                const id = req.getSublistValue({ group: SUB_ID, name: FLD_ID, line: i });
                if (marked && id) selected.add(String(id));
            }

            // Revalida status atual só uma vez (I/O único) para evitar atualizar itens já processados
            const statusById = fetchStatuses(loadedIds); // { id: '1'|'2'|'3'|... }
            const toApprove = [];
            const toReject = [];

            loadedIds.forEach((id) => {
                const current = statusById[id];
                if (current !== pending) return; // pula não pendentes 
                if (selected.has(id)) toApprove.push(id);
                else toReject.push(id);
            });

            // Atualizações dos status através de submitFields
            // Se não for recordtype e >100, migrar p/ MR.
            toApprove.forEach((id) => {
                record.submitFields({ type: REC_ID, id, values: { [FLD_STATUS]: approved } });
            });
            toReject.forEach((id) => {
                record.submitFields({ type: REC_ID, id, values: { [FLD_STATUS]: rejected } });
            });

            return refresh();

            function refresh() {
                redirect.toSuitelet({
                    scriptId: runtime.getCurrentScript().id,
                    deploymentId: runtime.getCurrentScript().deploymentId
                });
            }
        }

        function getStatusIds() {
            const script = runtime.getCurrentScript();
            const pending  = script.getParameter({ name: 'custscript_status_pending'  }) || '1';
            const approved = script.getParameter({ name: 'custscript_status_approved' }) || '2';
            const rejected = script.getParameter({ name: 'custscript_status_rejected' }) || '3';
            return { pending, approved, rejected };
        }
        // Busca status atual de uma lista de IDs em 1 chamada
        function fetchStatuses(ids) {
            const map = {};
            if (!ids.length) return map;

            // chunk defensivo de 1000 (limite seguro de filtro anyof); aqui ids <= 100
            const res = search.create({
                type: REC_ID,
                filters: [['internalid', 'anyof', ids]],
                columns: ['internalid', FLD_STATUS]
            }).run().getRange({ start: 0, end: ids.length });

            (res || []).forEach(r => {
                const id = String(r.getValue({ name: 'internalid' }));
                const st = String(r.getValue({ name: FLD_STATUS }) || '');
                map[id] = st;
            });
            return map;
        }

        return { onRequest };
    });
