var Mailchimp = require('mailchimp-api-v3');
var Mandrill = require('mandrill-api/mandrill');
var mailchimp = new Mailchimp(process.env.MAILCHIMP_KEY);
var mandrill = new Mandrill.Mandrill(process.env.MANDRILL_KEY);
var list = process.env.MAILCHIMP_LIST;
var express = require('express');
var exphbs  = require('express-handlebars');
var bodyParser = require('body-parser');
var md5 = require('js-md5');

var app = express();

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

	if(q.token && q.email) {
		mailchimp.get('/lists/' + list + '/members/' + md5(q.email.toLowerCase())).then( result => {
			if (result.unique_email_id != q.token) return null;
			return result;
		}).then( result => {
			var hasRSVP, RSVP;

			switch(result.merge_fields.RSVP) {
				case 0:
				hasRSVP = false;
				break;

				case 1:
				hasRSVP = true;
				RSVP = false;
				break;

				case 2:
				RSVP = true;
				hasRSVP = true;
				break;
			}

			response.render('home', {
				result,
				RSVP,
				hasRSVP
			});
		});
	} else {
		response.render('home');
	}
});

app.post('/rsvp', (request, response) => {
	var p = request.body;

	if((p.token && p.answer)) {
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

		mailchimp.patch('/lists/' + list + '/members/' + p.token, {
			'merge_fields' :{
				RSVP,
				DIETARY
			}
		}).then( result => {
			var RSVP;

			switch(result.merge_fields.RSVP) {
				case 1:
				RSVP = null;
				break;

				case 2:
				RSVP = true;
				break;
			}

			response.render('rsvp', {
				result,
				RSVP,
				DIETARY
			});
		});
	} else {
		response.redirect('/');
	}
});

app.post('/login', (request, response) => {
	var p = request.body;

	if(p.email) {
		mailchimp.get('/lists/' + list + '/members/' + md5(p.email)).then( result => {

			mandrill.messages.send({
				"message": require("./login.js")(result),
				"async": false,
				"ip_pool": "Main Pool",
				"send_at": "2000-01-05 12:42:01"
			}, function(email_result) {
    			response.render('login', {
					result,
					email_result
				});

			}, function(e) {
			    // Mandrill returns the error as an object with name and message keys
			    console.log('A mandrill error occurred: ' + e.name + ' - ' + e.message);
				response.redirect('/');

			});

		}, result => {
			response.render('login', {
					
				});
		});
	} else {
		response.redirect('/');
	}
});

app.get('/list', (request, response) => {
	var token = request.query ? request.query['token'] : null;

	if(token && token == process.env.MAILCHIMP_KEY) {
		mailchimp.get('/lists/' + list + '/members/?count=100&status=subscribed').then( result => {
			var COMING = 0, NOT_COMING = 0, WAITING = 0;
			var coming = [], not_coming = [], waiting = [];

			var members = result.members.sort(function (a, b) {
			  return b.merge_fields.RSVP - a.merge_fields.RSVP;
			});

			members.forEach(function(member){
				switch(member.merge_fields.RSVP){
					case 2:
					COMING += member.merge_fields.COUNT;
					coming.push(member);
					break;

					case  1:
					NOT_COMING += member.merge_fields.COUNT;
					not_coming.push(member);
					break;

					default:
					WAITING += member.merge_fields.COUNT;
					waiting.push(member);
					break;
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

app.get('/notify', (request, response) => {
	response.status(200);
    response.send();

});

app.post('/notify', (request, response) => {
	var p = request.body.data;

	var NAME = p.merges.NAME;
	var EMAIL = p.email;
	var COUNT = p.merges.COUNT;
	var DIETARY = p.merges.DIETARY || '';
	var RSVP = parseInt(p.merges.RSVP) > 1 ? "Yes" : "No";

	mandrill.messages.send({
		"message": {
	        "html": "<p>" + NAME + "(" + COUNT + ") has RSVPd (" + RSVP + ").</p><p>" + DIETARY + "</p>",
	        "subject": "RSVP: " + NAME + " (" + RSVP + ")",
	        "from_email": EMAIL,
	        "from_name": NAME,
	        "auto_text": true,
	        "to": [{
	                "email": "ludwig@wendzich.com",
	                "name": "Ludwig Wendzich",
	                "type": "to"
	            },
	            {
	                "email": "theron.natalie@gmail.com",
	                "name": "Natalie Theron",
	                "type": "to"
	            }],
	        "headers": {
	            "Reply-To": "ludwig@wendzich.com"
	        },
	        "view_content_link": true
	    },
		"async": false,
		"ip_pool": "Main Pool",
		"send_at": "2000-01-05 12:42:01"
	}, function(result) {
			response.status(200);
		    response.send();

	}, function(e) {
	    // Mandrill returns the error as an object with name and message keys
	    console.log('A mandrill error occurred: ' + e.name + ' - ' + e.message);
		response.redirect('/');

	});

	response.status(200);
    response.send();

});

app.get('/tokenize', (request, response) => {

	mailchimp.get('/lists/' + list + '/members/?count=100&status=subscribed').then( result => {

			var members = result.members;

			members.forEach(function(member){
				var TOKEN = member.unique_email_id;
				mailchimp.patch('/lists/' + list + '/members/' + member.id, {
					'merge_fields' :{
						TOKEN
					}
				}).then( result => {
					console.log(result.merge_fields)
				});
			});

			response.status(200);
			response.send();
		});
});

app.listen(app.get('port'),() => {
  console.log('Node app is running on port', app.get('port'));
});

