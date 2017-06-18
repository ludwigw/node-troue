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

app.listen(app.get('port'),() => {
  console.log('Node app is running on port', app.get('port'));
});

