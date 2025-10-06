/**
 *@NApiVersion 2.1
 *@NScriptType WorkflowActionScript
 */
define(['N/search', 'N/error'], (search, error) => {

    const FLD_SUBSIDIARY = 'subsidiary';                         // Subsidiária
    const SUB_FLD_SEM_CODIGO = 'custrecord_tst_sem_codigo';      // checkbox na Subsidiária

    const FLD_ENTITY = 'entity';                                 // Cliente
    const CUST_FLD_BANCO = 'custentity_tst_banco';               // select -> customrecord_tst_banco
    const CUST_FLD_CODIGO = 'custentity_tst_codigo';             // text

    const BANK_REC_TYPE = 'customrecord_tst_banco';              // recordtype
    const BANK_FLD_CODPROMO = 'custrecord_banco_codpromo';       // checkbox

    const TXN_FLD_FLAG_CODIGO = 'custbody_tst_codigo';           // checkbox
    const TXN_FLD_COD_PROMO = 'custbody_tst_codigo_promocional'; // text

    function onAction(scriptContext) {
        const rec = scriptContext.newRecord;
        
        // 1) Verifica o campo Subsidiária
        const subsidiaryId = rec.getValue({ fieldId: FLD_SUBSIDIARY });
        if (!subsidiaryId) return 'OK: sem subsidiária';

        const subFlags = search.lookupFields({
            type: search.Type.SUBSIDIARY,
            id: subsidiaryId,
            columns: [SUB_FLD_SEM_CODIGO]
        });
        const exigeCodigo = !!subFlags[SUB_FLD_SEM_CODIGO];

        // 2) Verifica se NÃO exige código, libera sem validar
        if (!exigeCodigo) return 'OK: subsidiária não exige código';

        // 3) Verifica o campo Cliente 
        const customerId = rec.getValue({ fieldId: FLD_ENTITY });
        if (!customerId) return 'OK: sem cliente';

        // 4) Busca no Customer (lookupFields)
        const custData = search.lookupFields({
            type: search.Type.CUSTOMER,
            id: customerId,
            columns: [CUST_FLD_BANCO, CUST_FLD_CODIGO]
        });
        const bancoId = normalizeSelect(custData[CUST_FLD_BANCO]);
        const codigo = String(custData[CUST_FLD_CODIGO] || '').trim();

        if (!bancoId) {
            throw error.create({
                name: 'REQ1_MISSING_BANK',
                message: 'O campo Banco não está preenchido no registro do Cliente.',
                notifyOff: false
            });
        }
        if (!codigo) {
            throw error.create({
                name: 'REQ1_MISSING_CODE',
                message: 'O campo Código não está preenchido no registro do Cliente.',
                notifyOff: false
            });
        }

        // 5) Banco tem código promocional? (lookupFields — sem load)
        const bankData = search.lookupFields({
            type: BANK_REC_TYPE,
            id: bancoId,
            columns: [BANK_FLD_CODPROMO]
        });
        const temCodPromo = !!bankData[BANK_FLD_CODPROMO];

        // 6) Se promo ativa e cliente tem código → setar flag/cópia no próprio newRecord
        if (temCodPromo) {
            rec.setValue({ fieldId: TXN_FLD_FLAG_CODIGO, value: true });
            rec.setValue({ fieldId: TXN_FLD_COD_PROMO, value: codigo });
        }

        return 'OK';
    }

    const normalizeSelect = (value) => {
        if (!value) return '';
        if (Array.isArray(value)) return value.length ? String(value[0].value ?? value[0]) : '';
        if (typeof value === 'object' && value.value != null) return String(value.value);
        return String(value);
    };

    return {
        onAction: onAction
    }
});
