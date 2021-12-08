# MetamonPlay-iOS
Simple script to play Metamon Island game automatically on iOS

# Getting Started

[Radio Caca]

[Radio Caca]: https://www.radiocaca.com

## Important disclaimer
This script is writen with javascript, it only run on [Scriptable] application for iOS. It uses
sensitive signature code from MetaMask wallet which 
needs to be safe and secure at all times. Make sure 
to inspect the code for any attempts to send your 
information anywhere except https://metamon-api.radiocaca.com/usm-api 
(official metamon game api). We are not responsible 
for any loss incurred when you use this script!

[Scriptable]: https://scriptable.app/

## Prerequisites

To start using this script on iOS devices (iPhone, iPad), your's device needs to be 
installed [Scriptable] app.

[Scriptable]: https://scriptable.app/

## Prepare wallet(s) information

First open [game] with your browser and make sure 
your wallet is active in MetaMask plugin. Enter
dev mode in browser (Chrome press Ctrl + Shift + I,
or go to menu -> More Tools -> Developer Tools)
<img src="screenshots/enter_game_dev.png" />
select "Network" and "Fetc/XHR" in developer tools menu.

[game]: https://metamon.radiocaca.com

! <b>Imoprtant: make sure to do it before signing 
in with MetaMask</b> !

<img src="screenshots/enter_game_sign.png" />

After login entry with "login" name should appear 
in the list of requests of developers tools.
<img src="screenshots/enter_game_login.png" />
There
after clicking on it and selecting "payload" in new 
menu all 3 essential values wil appear (address, sign, 
msg) copy those values and save in file (for example
default is "wallets.tsv" in same dir where you run it).

<img src="screenshots/enter_game_credentials.png" />

File should have 4 columns comma separated (csv):

    name,address,sign,msg
    Wallet1,0x123..,0x23...,LogIn-...

Name is custom, choose what you want. If you save 
stats to file it will be used for name of that file.
If you have multiple wallets you can add several rows
to this csv file.

Send files to iOS device, then put them in to iCloud drive
<img src="screenshots/photo_1.jpg" />

# Preparation is complete! 
## Ready to roll?

Open Scriptable app, you can see MetamonPlay script, tap on it and fighting
<img src="screenshots/photo_2.jpg" />

Will try to read file wallets.tsv in iCloud drive,
auto fight, mint eggs, and save stats to corresponding 
files. Now you ready to have fun and explore other options.

<b> Note: </b> Since fee for all leagues is the same bot will 
try to fight in highest league for corresponding metamon and 
it is not configurable at this 
time.

Also if there will be interest we can release version which
uses access token instead of signature (tokens expire and it
is more secure to use, however it will require manual step of
obtaining one every day for battles)

Hope you will have fun playing and this script will make it 
a little bit less tedious. Enjoy!

<b>₿₿₿ Sponsor me some Raca if you feel happy:</b>

    0x5c78c7F9D078c82EEc2b083aa622aaFDb82AEad3
