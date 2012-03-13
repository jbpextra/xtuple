// ==========================================================================
// Project:   xTuple Postbooks - Business Management System Framework        
// Copyright: ©2012 OpenMFG LLC, d/b/a xTuple                             
// ==========================================================================

/*globals XM */

sc_require('xbos/__generated__/_invoice');
sc_require('mixins/document');

/**
  @class

  @extends XM._Invoice
  @extends XM.Document
*/
XM.Invoice = XM._Invoice.extend(XM.Document,
  /** @scope XM.Invoice.prototype */ {
  
  numberPolicySetting: 'InvcNumberGeneration',
  
  invoiceDate: SC.Record.attr(SC.DateTime, {
    format: '%Y-%m-%d',
    
    defaultValue: function() {
      return SC.DateTime.create();
    }
  }),
  
  orderDate: SC.Record.attr(SC.DateTime, {
    format: '%Y-%m-%d',
    
    defaultValue: function() {
      return SC.DateTime.create();
    }
  }),
  
  shipDate: SC.Record.attr(SC.DateTime, {
    format: '%Y-%m-%d',
    
    defaultValue: function() {
      return SC.DateTime.create();
    }
  }),
  
  currency: SC.Record.toOne('XM.Currency', {
    defaultValue: function() {
      return XM.Currency.BASE;
    }
  }),

  isPrinted: SC.Record.attr(Boolean, {
    defaultValue: false  
  }),

  isPosted: SC.Record.attr(Boolean, {
    defaultValue: false  
  }),

  freeFormBillto: false,
  
  freeFormShipto: false,
  
  /* @private */
  creditsLength: 0,
  
  /* @private */
  creditsLengthBinding: SC.Binding.from('.credits.length').noDelay(),
  
  /** @private */
  taxesLength: 0,
  
  /** @private */
  taxesLengthBinding: SC.Binding.from('.taxes.length').noDelay(),
  
  /* @private */
  linesLength: 0,
  
  /* @private */
  linesLengthBinding: SC.Binding.from('.lines.length').noDelay(),
  
  subTotal: 0,
  
  lineTax: 0,
  
  lineTaxCodes: [],
  
  freightTaxCodes: [],
  
  miscTaxCodes: [],
  
  // .................................................
  // CALCULATED PROPERTIES
  //
  
  credit: function() {
    var credits = this.get('credits'),
        total = 0;
    
    for(var i = 0; i < credits.get('length'); i++) {
      total = total + credits.objectAt(i).get('amount');
    }
    
    return total;
  }.property('creditsLength').cacheable(),
  
  freightTax: function() {    
    var taxes = this.get('taxes'), freightTax = 0;

    for(var i = 0; i < taxes.get('length'); i++) {
      var hist = taxes.objectAt(i),
          type = hist.getPath('taxType.id'),
          tax = hist.get('tax');
    
      freightTax = freightTax + (type === XM.TaxType.FREIGHT ? tax : 0);
    }
    
    return freightTax;
  }.property('taxesLength').cacheable(),
  
  miscTax: function() {    
    var taxes = this.get('taxes'), adjTax = 0;
    
    for(var i = 0; i < taxes.get('length'); i++) {
      var hist = taxes.objectAt(i),
          type = hist.getPath('taxType.id'),
          tax = hist.get('tax');
        
      adjTax = adjTax + (type === XM.TaxType.ADJUSTMENT ? tax : 0);
    }
    
    return adjTax;
  }.property('taxesLength').cacheable(),
  
  totalTax: function() {
    var lineTax = this.get('lineTax'),
        freightTax = this.get('freightTax'),
        miscTax = this.get('miscTax');
        
    return lineTax + freightTax + miscTax; 
  }.property('lineTax', 'freightTax', 'miscTax').cacheable(),
  
  total: function() {
    var subTotal = this.get('subTotal'),
        freight = this.get('freight'),
        tax = this.get('tax');
        
    return subTotal + freight + tax; 
  }.property('subTotal', 'freight', 'tax').cacheable(),
  
  //..................................................
  // METHODS
  //
  
  post: function() {
    return false;
  },
  
  void: function() {
    return false;
  },

  //..................................................
  // OBSERVERS
  //
  
  validate: function() {
    var errors = this.get('validateErrors'), val, err;

    // Validate Number
    val = this.get('number') ? this.get('number').length : 0;
    err = XM.errors.findProperty('code', 'xt1001');
    this.updateErrors(err, !val);

    // Validate Invoice Date
    val = this.get('invoiceDate');
    err = XM.errors.findProperty('code', 'xt1012');
    this.updateErrors(err, !val);
    
    // Validate Customer
    val = this.get('customer');
    err = XM.errors.findProperty('code', 'xt1011');
    this.updateErrors(err, !val);

    // Validate Currency
    val = this.get('currency');
    err = XM.errors.findProperty('code', 'xt1014');
    this.updateErrors(err, !val);

    // Validate Terms
    val = this.get('terms');
    err = XM.errors.findProperty('code', 'xt1013');
    this.updateErrors(err, !val);

    // Validate Commission
    val = this.get('commission');
    err = XM.errors.findProperty('code', 'xt1016');
    this.updateErrors(err, isNaN(val));

    // Validate Lines
    val = this.get('linesLength');
    err = XM.errors.findProperty('code', 'xt1010');
    this.updateErrors(err, !val);

    // Validate Freight
    val = this.get('freight');
    err = XM.errors.findProperty('code', 'xt1015');
    this.updateErrors(err, isNaN(val));

    // Validate Total
    val = this.get('total');
    err = XM.errors.findProperty('code', 'xt1009');
    this.updateErrors(err, val < 0);

    return errors;
  }.observes('number', 'customer', 'linesLength', 'total'),
  
  /**
    Populates customer defaults when customer changes.
  */
  customerDidChange: function() {
    var customer = this.get('customer'),
        status = this.get('status');

    this.set('isFreeFormBillto', customer.get('isFreeFormBillto'));
    this.set('isFreeFormShipto', customer.get('isFreeFormShipto'));
    
    // pass defaults in
    if(status === SC.Record.READY_NEW) {
      if(customer) {
        var address = customer.getPath('billingContact.address');
  
        this.set('salesRep', customer.getPath('salesRep'));
        this.set('commission', customer.get('commission') * 100);
        this.set('terms', customer.get('terms'));
        this.set('taxZone', customer.get('taxZone'));
        this.set('currency', customer.get('currency'));
        this.set('shipCharge', customer.get('shipCharge'));
        this.set('shipto', customer.get('shipto'));
        this.set('billtoName', customer.get('name'));
        this.set('billtoPhone', customer.getPath('billingContact.phone'));
        
        if(address) {
          this.set('billtoAddress1', address.get('line1'));
          this.set('billtoAddress2', address.get('line2'));
          this.set('billtoAddress3', address.get('line3'));
          this.set('billtoCity', address.get('city')); 
          this.set('billtoState', address.get('state'));
          this.set('billtoPostalCode', address.get('postalCode'));
          this.set('billtoCountry', address.get('country'));  
        }
      } else {
        this.set('salesRep', null);
        this.set('commission', 0);
        this.set('terms', null);
        this.set('taxZone', null);
        this.set('currency', null);
        this.set('shipCharge', null);
        this.set('shipto', null);
        this.set('billtoName', '');
        this.set('billtoPhone', '');
        this.set('billtoAddress1','');
        this.set('billtoAddress2', '');
        this.set('billtoAddress3', '');
        this.set('billtoCity', ''); 
        this.set('billtoState', '');
        this.set('billtoPostalCode', '');
        this.set('billtoCountry', '');
        this.set('billtoPhone', '');
      }
        
    // can not change customer after committing
    } else if (status & SC.Record.READY) {
      this.set('customer', this._attrCache.get('customer'));
    }
  }.observes('customer'),
  
  /**
    Populates shipto defaults when shipto changes.
  */
  shiptoDidChange: function() {
    var shipto = this.get('shipto'),
        customer = this.get('customer');
    
    if(status & SC.Record.READY) {
      if(shipto) {
        var address = shipto.get('address');
       
        this.set('salesRep', shipto.get('salesRep'));
        this.set('commission', shipto.get('commission') * 100);
        this.set('taxZone', shipto.get('taxZone'));
        this.set('shipCharge', shipto.get('shipCharge'));
        this.set('shiptoName', shipto.get('name'));
        this.set('shiptoPhone', shipto.getPath('contact.phone'));
        
        if(address) {
          this.set('shiptoAddress1', address.get('line1'));
          this.set('shiptoAddress2', address.get('line2'));
          this.set('shiptoAddress3', address.get('line3'));
          this.set('shiptoCity', address.get('city')); 
          this.set('shiptoState', address.get('state'));
          this.set('shiptoPostalCode', address.get('postalCode'));
          this.set('shiptoCountry', address.get('country'));
        }
        
      } else if(customer) {
        this.set('salesRep', customer.get('salesRep'));
        this.set('taxZone', customer.get('taxZone'));
        this.set('currency', customer.get('currency'));
        this.set('shipCharge', customer.get('shipCharge'));
      } else {
        this.set('salesRep', null);
        this.set('commission', 0);
        this.set('taxZone', null);
        this.set('shipCharge', null);
      }  
      
      if(!shipto) {
        this.set('shiptoName', '');
        this.set('shiptoAddress1', '');
        this.set('shiptoAddress2', '');
        this.set('shiptoAddress3', '');
        this.set('shiptoCity', ''); 
        this.set('shiptoState', '');
        this.set('shiptoPostalCode', '');
        this.set('shiptoCountry', '');
        this.set('shiptoPhone', '');
      }
    }
  }.observes('shipto'),
    
  linesDidChange: function() {
    var lines = this.get('lines'),
        taxes, taxTypes = [], taxCodes = [],
        taxTotal = 0;

    // First sub total taxes by tax type
    for(var i = 0; i < lines.get('length'); i++) {
      taxes = lines.objectAt(i).get('taxes');
 
      for(var n = 0; n < taxes.get('length'); n++) {
        var lineTax = taxes.objectAt(n),
            taxType = lineTax.get('taxType'),
            taxCode = lineTax.get('taxCode'),
            tax = lineTax.get('tax') - 0,
            typeTotal = taxTypes.findProperty('taxType', taxType),
            codeTotal = codeTypes.findProperty('taxCode', taxCode);
         
        // summaryize by tax type
        if(typeTotal) {
          typeTotal.tax = typeTotal.tax + tax;
        } else {
          typeTotal = {};
    
          typeTotal.taxType = taxType;
          typeTotal.tax = tax;
          taxTypes.push(typeTotal);
        }
        
        // summarize by tax code
        if(codeTotal) {
          codeTotal.tax = codeCode.tax + tax;
        } else {
          codeTotal = {};
    
          codeTotal.taxCode = taxCode;
          codeTotal.tax = tax;
          codeTypes.push(codeTotal);
        }       
      }
    }
    
    // next round each tax type total and add to line tax total
    for(var i = 0; i < taxTypes.length; i++) {
      var typeTotal = taxTypes.objectAt(i);
      
      taxTotal = taxTotal + Math.round(typeTotal.tax * 100)/100;
    }
    
    this.set('lineTax', taxTotal);
  }.observes('linesLength'),
  
  isPostedDidChange: function() {
    var status = this.get('status');
    
    // can not change this directly
    if(status === SC.Record.READY_NEW) this.set('isPosted', false);
    else if(status & SC.Record.READY) this.set('isPosted', this._attrCache.get('isPosted'));
  }.observes('isPosted')

});

