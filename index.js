var Mailchimp = require('mailchimp-api-v3');
var Mandrill = require('mandrill-api/mandrill');
var CreateSend = require('createsend-node');

var mailchimp = new Mailchimp(process.env.MAILCHIMP_KEY);
var mandrill = new Mandrill.Mandrill(process.env.MANDRILL_KEY);
var createsend = new CreateSend({ apiKey: process.env.CREATESEND_KEY});

var list = process.env.MAILCHIMP_LIST;
var cmList = process.env.CREATESEND_LIST;

var express = require('express');
var exphbs  = require('express-handlebars');
var bodyParser = require('body-parser');
var md5 = require('js-md5');
var async = require('async');

var app = express();

var createRSVP = function (result) {

	var response = {
		Name: result.Name,
		Email: result.EmailAddress,
	};

	// Flatten Custom Fields
	result.CustomFields.forEach(function(field) {
		response[field.Key.replace(/[\[\]]/gi, '')] = field.Value;
	});

	// Update RSVP Value
	switch(parseInt(response.RSVP)) {
		case 0:
		response.hasRSVP = false;
		break;

		case 1:
		response.hasRSVP = true;
		response.RSVP = false;
		break;

		case 2:
		response.RSVP = true;
		response.hasRSVP = true;
		break;
	}

	return response;
};

app.engine('handlebars', exphbs({
	defaultLayout: 'main',
	helpers: {
		pluralize: function(number, singular, plural) {
		    if (number === 1)
		        return singular;
		    else
		        return (typeof plural === 'string' ? plural : singular + 's');
		},
		icon: function(number) {
			switch(number){
				case 2:
				return "fa-check";
				case  1:
				return "fa-close";
				default:
				return "fa-clock-o";
			}
		}
	}
}));

app.set('view engine', 'handlebars');
app.set('port', (process.env.PORT || 5000));
app.use(express.static('public'));

app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

app.get('/', (request, response) => {

	var q = request.query;
	var rsvp;

	if(q.token && q.email) {

		createsend.subscribers.getSubscriberDetails(cmList, q.email, (err, res) => {

			var rsvp;

			if(err) {
				console.log('CM Error:', err);
			} else {

				rsvp = createRSVP(res);

				if (rsvp.Token != q.token) {
					rsvp = null;
				}	
			}

			response.render('home', {
				rsvp
			});

		});
	} else {
		response.render('home');
	}
});

app.post('/rsvp', (request, response) => {
	var p = request.body;

	if((p.email && p.token && p.answer)) {
		var data = [];
		var RSVP;
		var DIETARY;

		switch(p.answer) {
			case "yes":
			RSVP = 2;
			break;

			case "no":
			RSVP = 1;
			break;

			default:
			RSVP = 0;
			break;

		}

		DIETARY = p['dietary-requirements'] ? p['dietary-requirements'] : null;

		if(DIETARY) data.push({Key: 'Dietary', Value: DIETARY});
		if(RSVP) data.push({Key: 'RSVP', Value: RSVP});

		async.waterfall([
			(done) => {
				createsend.subscribers.updateSubscriber(cmList, p.email, {
					CustomFields: data
				}, done);
			},
			(done) => {
				setTimeout(()=> {
					createsend.subscribers.getSubscriberDetails(cmList, p.email, done);
				},100);
			}
		], (err, res) => {
			var rsvp;

			if(err) {
				console.log('CM Error:', err);
				response.status(500);
				response.send();
			} else {

				rsvp = createRSVP(res);

				// API is async so when I read, I can’t guarantee the write has finished?
				// So make sure it says the right thing.
				rsvp.RSVP = (RSVP > 1 ? true : false);

				response.render('rsvp', {
					rsvp
				});
			}
		});

	} else {
		response.redirect('/');
	}
});

app.post('/login', (request, response) => {
	var p = request.body;
	var rsvp;

	// Create a details object
	var details = {
		smartEmailID: '43f81b90-4160-4226-bdeb-e815c408f8f5'
	};

	if(p.email) {

		async.waterfall([
			(done) => {

				createsend.subscribers.getSubscriberDetails(cmList, p.email, (err, res) => {

					if(err) {
						done("No invite");
					} else {

						rsvp = createRSVP(res);

						details.to = rsvp.Name + " <" + rsvp.Email + ">";
						details.data = {
							"Token": rsvp.Token,
							"email": rsvp.Email
						}

						done();
					}
				});
			},
			(done) => {

				createsend.transactional.sendSmartEmail(details, function (err, res) {
				    if (err) {
				        done(err);
				    } else {
				        done();
				    }
				});

			}
		], (err, res) => {
			response.render('login', {
				rsvp
			});
		});

	} else {
		response.redirect('/');
	}
});

app.get('/list', (request, response) => {
	var token = request.query ? request.query['token'] : null;

	if(token && token == process.env.CREATESEND_KEY) {

		createsend.lists.getActiveSubscribers(cmList, '', (err, res) => {

			var COMING = 0, NOT_COMING = 0, WAITING = 0;
			var coming = [], not_coming = [], waiting = [];

			res.Results.forEach(function(result){
				
				var member = createRSVP(result);

				if(member.hasRSVP) {
					if(member.RSVP == true) {
						COMING += parseInt(member.Count);
						coming.push(member);
					} else {
						NOT_COMING += parseInt(member.Count);
						not_coming.push(member);
					}
				} else {
					WAITING += parseInt(member.Count);
					waiting.push(member);
				}
			});

			response.render('list', {
				coming,
				COMING,
				not_coming,
				NOT_COMING,
				waiting,
				WAITING
			});
		});

	} else {
		response.redirect('/');
	}

});

// Let’s MailChimp confirm the webhook handler exists
app.get('/notify', (request, response) => {
	response.status(200);
    response.send();

});

// Send a notification to Natalie and myself that an RSVP has occurred.
app.post('/notify', (request, response) => {

	var rsvp = createRSVP(request.body.Events[0]);
	var details = {
		smartEmailID: '4829db53-0d8d-4289-b91c-90df6f76443c',
		to: [
			"Ludwig Wendzich <ludwig@wendzich.com>",
			"Natalie Theron <theron.natalie@gmail.com"
		],
		data: {
		    "Name": rsvp.Name,
			"RSVP": rsvp.RSVP,
			"Count": rsvp.Count,
			"Dietary": rsvp.Dietary || '',
			"Token": rsvp.Token,
			"email": rsvp.Email
		}
	}

	createsend.transactional.sendSmartEmail(details, function (err, res) {
		if (err) {
		    console.log('A CM error occurred: ' + e.name + ' - ' + e.message);
			response.redirect('/');
		} else {
			response.status(200);
		    response.send();
		}
	});

});

app.get('/create-webhook', (request, response) => {

	createsend.lists.createWebhook(cmList, {
	    "Events": [ "Update" ],
	    "Url": "ludnat.wendzich.com/notify",
	    "PayloadFormat": "json"
	}, (err, res) => {
		console.log(res);
		response.status(200);
		response.send();
	});

});

app.get('/test-webhook', (request, response) => {

	createsend.lists.testWebhook(cmList, 'a4e05a7a89bd9d670062efd89faa6523', (err, res) => {
		console.log(err, res);
		response.status(200);
		response.send();
	});

});

// Save MailChimp Unique Email ID to Merge Field: TOKEN
app.get('/tokenize', (request, response) => {

	mailchimp.get('/lists/' + list + '/members/?count=100&status=subscribed').then( result => {

			var members = result.members;
			var calls = [];

			members.forEach(function(member){
				var TOKEN = member.unique_email_id;
				calls.push((done)=>{

					mailchimp.patch('/lists/' + list + '/members/' + member.id, {
						'merge_fields' :{
							TOKEN
						}
					}).then( result => {
						console.log(result.merge_fields)
						done();
					});

				});
			});

			async.parallelLimit(calls, 10, () => {

				console.log("Done");
				response.status(200);
				response.send();

			});

		});
});

// Copy details from MailChimp to CampaignMonitor
// Requires Members in MailChimp to already exist as Subscribers in CampaignMonitor
app.get('/transfer', (request, response) => {

	mailchimp.get('/lists/' + list + '/members/?count=100&status=subscribed').then( result => {

			var members = result.members;
			var calls = [];

			members.forEach(function(member){
				calls.push((done) => {

					createsend.subscribers.updateSubscriber(cmList, member.email_address, {
						Name: member.merge_fields.NAME,
						CustomFields: [
							{ Key: 'Token', Value: member.merge_fields.TOKEN },
							{ Key: 'Count', Value: member.merge_fields.COUNT },
							{ Key: 'RSVP', Value: member.merge_fields.RSVP },
							{ Key: 'Dietary', Value: member.merge_fields.DIETARY },
							{ Key: 'Lang', Value: member.merge_fields.LANG }
						]
					}, (err, res) => {
					  if (err) console.log(err);
					  console.log("Updated:" + member.email_address);
					  done();
					});

				});

			});

			async.parallelLimit(calls, 10, () => {

				console.log("Done.");
				response.status(200);
				response.send();

			});

		});

});

app.listen(app.get('port'),() => {
  console.log('Node app is running on port', app.get('port'));
});

