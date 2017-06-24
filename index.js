var CreateSend = require('createsend-node');
var express = require('express');
var exphbs  = require('express-handlebars');
var bodyParser = require('body-parser');
var async = require('async');
var uid = require('rand-token').uid;

var createsend = new CreateSend({ apiKey: process.env.CREATESEND_KEY});
var list = process.env.CREATESEND_LIST;

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

var generateToken = function (result) {
	return uid(10);
}

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

// View an Invitation
app.get('/', (request, response) => {

	var q = request.query;
	var rsvp;

	if(q.token && q.email) {

		createsend.subscribers.getSubscriberDetails(list, q.email, (err, res) => {

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

// Submit an RSVP response.
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
				createsend.subscribers.updateSubscriber(list, p.email, { CustomFields: data }, done);
			},
			(done) => {
				createsend.subscribers.getSubscriberDetails(list, p.email, done);
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

// Send a login link to the email if it is invited.
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

				createsend.subscribers.getSubscriberDetails(list, p.email, (err, res) => {

					if(err) {
						return done("No invite");
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
				createsend.transactional.sendSmartEmail(details, done);
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

// See a list of all subscribers organised by RSVP status.
app.get('/list', (request, response) => {
	var token = request.query ? request.query['token'] : null;

	if(token && token == process.env.CREATESEND_KEY) {

		createsend.lists.getActiveSubscribers(list, '', (err, res) => {

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

// Send a notification to Natalie and myself that an RSVP has occurred.
app.post('/notify', (request, response) => {

	var rsvp = createRSVP(request.body.Events[0]);
	var details = {
		smartEmailID: '4829db53-0d8d-4289-b91c-90df6f76443c',
		to: [
			"Ludwig Wendzich <ludwig@wendzich.com>",
			"Natalie Theron <theron.natalie@gmail.com>"
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
		    console.log(err);
			response.redirect('/');
		} else {
			response.status(200);
		    response.send();
		}
	});

});

app.get('/create-webhook', (request, response) => {

	createsend.lists.createWebhook(list, {
	    "Events": [ "Update" ],
	    "Url": "http://ludnat.wendzich.com/notify",
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

// Generate tokens for Subscribers without Tokens.
app.get('/tokenize', (request, response) => {

	var calls = [];

	createsend.lists.getActiveSubscribers(list, '', (err, res) => {
		var results = res.Results;

		results.forEach(result => {
			result = createRSVP(result);

			if(!result.Token) {
				calls.push((done)=> {
					createsend.subscribers.updateSubscriber(list, result.Email,
						{
							CustomFields: {
								Token: generateToken(result)
							}
						}, done);
				});
			}

		});

		async.parallelLimit(calls, 10, (err, res) => {

			if (err) {
			    console.log(err);
				response.status(500);
			    response.send();
			} else {
				response.status(200);
			    response.send();
			}

		});

	});

});

app.listen(app.get('port'),() => {
  console.log('Node app is running on port', app.get('port'));
});

