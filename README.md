# node-troue

A Mailchimp List backed RSVP app that runs on Node in Heroku.

## Running Locally

Make sure you have the following file, `env.sh`:

```sh
export MAILCHIMP_KEY=<API-Key>
export MAILCHIMP_LIST=<List-ID>
export MANDRILL_KEY=<API-Key>
```

```sh
$ source env.sh
$ npm install
$ npm start
```

Your app should now be running on [localhost:5000](http://localhost:5000/).

## Deploying to Heroku

Setup the above ENV variables on Heroku.

```
$ git push heroku master
$ heroku open
```
or

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.png)](https://heroku.com/deploy)
