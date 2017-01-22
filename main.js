/*
 * ISC License
 * Copyright (c) 2016, Nexrem
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
 * REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
 * AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
 * INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
 * LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
 * OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
 * PERFORMANCE OF THIS SOFTWARE.
 */

"use strict";
var Discordie = require("discordie"); // discord API
var fs = require("fs"); // Node filesystem
var express = require('express'); // require express API for network stuffs
var request = require('request'); // request API
var plist = require("plist"); // plist parser
var Jimp = require("jimp"); // image manipulator

var client = new Discordie(); // creates new bot instance
var app = express(); // creates new express app instance

var port = process.env.PORT || 8080; // assign port. if no port given use localhost
initExpress(); // initializes express port listening


//////////////////////////////////// INIT //////////////////////////////////////

var textureScaleFactor = 0.5; // the texture scale. used in offsets BASE IS 2048
var loading = true; // indicates loading state;
var config = JSON.parse(fs.readFileSync("./config.json", "utf8")); // parse config file
var colors = JSON.parse(fs.readFileSync("./resources/player/colors.json", "utf8")); // parse color storage file
var tracks = JSON.parse(fs.readFileSync("./resources/level/tracks.json", "utf8")); // parse audio tracks file
var iconList = JSON.parse(fs.readFileSync("./resources/player/iconList.json", "utf8"));
var sheetData = plist.parse(fs.readFileSync("./resources/player/player-spritesheet.plist", "utf8")).frames;
var icons = Object.keys(sheetData).filter(removeGlow); // get all icon names and filter

// load static images
var spritesheet; // placeholder
var bigFont; // placeholder
var bigFontHD // placeholder
var bigFontYellow // placeholder
var descriptionFont // placeholder
// load all static images and bind them to global vars. We never change these.
Jimp.read("./resources/player/player-spritesheet.png", function(err1, image1) {
	spritesheet = image1;
	Jimp.loadFont("./resources/bigFont.fnt", function(err2, font1) {
		bigFont = font1;
		Jimp.loadFont("./resources/bigFont-hd.fnt", function(err3, font2) {
			bigFontHD = font2;
			Jimp.loadFont("./resources/bigFont-yellow.fnt", function(err4, font3) {
				bigFontYellow = font3;
				Jimp.loadFont(Jimp.FONT_SANS_32_WHITE, function(err5, font4) {
					descriptionFont = font4
					if (err1 || err2 || err3 || err4 || err5) console.log([err1, err2, err3, err4, err5]);
					console.log("Finished initialization!");
				});
			});
		});
	});
});

client.connect({
	token: config.token
}); // connects to the Discord servers using token.

// when the bot has connected succesfully and is receiving inputs.
client.Dispatcher.on("GATEWAY_READY", function(e) {

	console.log("Connected! " + client.User.username + " [" + client.User.id + "] ");
	client.User.setStatus("online", config.playing); // online, playing
	client.User.setUsername(config.name); // username
});

// ping self every 5 minutes
setInterval(function() {
	request.get(config["getTarget"]);
}, 300000);


//////////////////////////////// RUNTIME ///////////////////////////////////////

client.Dispatcher.on("MESSAGE_CREATE", function(e) {
	// checks if message starts with the command prefix.
	if (e.message.content.substring(0, config.command_prefix.length) == config.command_prefix) {
		let messageContent = e.message.content.substr(config.command_prefix.length); // remove the prefix from the message
		let messageCommand = messageContent.toLowerCase().split(" "); // split into array at space

		// check if user stats command
		if (messageCommand[0] == "stats" || messageCommand[0] == "player" || messageCommand[0] == "user") {

			// check if not blank
			if (messageCommand.length > 1) {
				let GD_user = messageContent.substr(messageCommand[0].length + 1); // remove command and empty space after it
				getUserStats(GD_user, e.message); // pass to poller
			} else {
				errorOut(5, e.message); // if blank error out
			};
		}
		// check if level stats command
		else if (messageCommand[0] == "level" || messageCommand[0] == "userlevel") {

			// check if not blank
			if (messageCommand.length > 1) {
				let GD_level = messageContent.substr(messageCommand[0].length + 1); // remove command and empty space after it
				getLevelStats(GD_level, e.message); // pass to poller
			} else {
				errorOut(6, e.message); // if blank error out
			};
		};
	};
});

///////////////////////////////////// MISC /////////////////////////////////////

// Use the search function to get ID
function getUserStats(GD_user, mseg) {

	//////////// FIRST REQUEST
	// post request to the boomlings server
	request.post({
			url: 'http://www.boomlings.com/database/getGJUsers20.php',
			form: {
				gameVersion: "20",
				binaryVersion: "30",
				str: GD_user,
				total: "0",
				page: "0",
				secret: "Wmfd2893gb7"
			}
		},
		// returns post data
		function(err, httpResponse, body) {
			// parses response data
			if (err) {
				console.log(err + "\n" + httpResponse);
				errorOut(1, mseg);
			} else if (body == "-1") {
				errorOut(0, mseg);
			} else {

				let objectArray = formatData(body.split("|")[0]);

				// Use the ID to get account info
				//////////// SECOND REQUEST
				// post request to the boomlings server
				request.post({
						url: 'http://www.boomlings.com/database/getGJUserInfo20.php',
						form: {
							gameVersion: "20",
							binaryVersion: "30",
							targetAccountID: objectArray["16"],
							secret: "Wmfd2893gb7"
						}
					},
					// returns post data
					function(err2, httpResponse2, body2) {
						// parses response data
						if (err2) {
							console.log(err2 + "\n" + httpResponse2);
							errorOut(1, mseg);
						} else if (body2 == "-1") {
							errorOut(0, mseg);
						} else {

							let objectArray = formatData(body2.split("|")[0]);

							// bind data values to variables
							let USERNAME = objectArray["1"] || "unknown";
							let USERID = objectArray["2"] || "unknown";
							let COINS = objectArray["13"] || "0";
							let USERCOINS = objectArray["17"] || "0";
							let COLOR1 = objectArray["10"] || "0";
							let COLOR2 = objectArray["11"] || "3";
							let STARS = objectArray["3"] || "0";
							let DEMONS = objectArray["4"] || "0";
							let CREATORPOINTS = objectArray["8"] || "0";
							let ACCOUNTID = objectArray["16"] || "unknown";
							let YOUTUBE = objectArray["20"] || "";
							let ICON = objectArray["21"] || "1";
							let SHIP = objectArray["22"] || "1";
							let BALL = objectArray["23"] || "1";
							let UFO = objectArray["24"] || "1";
							let DART = objectArray["25"] || "1";
							let ROBOT = objectArray["26"] || "1";
							let GLOW = objectArray["28"] || "0";
							let SPIDER = objectArray["43"] || "1";
							let DIAMONDS = objectArray["46"] || "0";

							// display unknown for unknown icons and colors
							if (parseInt(ICON) > iconList.icon) ICON = iconList.icon;
							if (parseInt(SHIP) > iconList.ship) SHIP = iconList.ship;
							if (parseInt(BALL) > iconList.ball) BALL = iconList.ball;
							if (parseInt(UFO) > iconList.ufo) UFO = iconList.ufo;
							if (parseInt(DART) > iconList.wave) DART = iconList.wave;
							if (parseInt(ROBOT) > iconList.robot) ROBOT = iconList.robot;
							if (parseInt(SPIDER) > iconList.spider) SPIDER = iconList.spider;
							if (parseInt(COLOR1) > colors.count) COLOR1 = "0";
							if (parseInt(COLOR2) > colors.count) COLOR2 = "3";

							// fix log crashes
							let channelName = "PRIV_MESSAGE";
							let guildName = "PRIV_MESSAGE";
							if (mseg.guild != null && mseg.channel != null) {
								channelName = mseg.channel.name;
								guildName = mseg.guild.name;
							};

							// log
							console.log("User request by: " + mseg.author.username + " [" + mseg.author.id +
								"] || " + guildName + " [" + channelName + "] || [" + GD_user + "]"
							);

							// sends to card generator
							generatePlayerCard(mseg, ICON, SHIP, BALL, UFO, DART, ROBOT, SPIDER, COLOR1, COLOR2, GLOW, USERNAME, COINS, USERCOINS, STARS, DEMONS, CREATORPOINTS, DIAMONDS);

						};
					});
			};
		});
};

// gets level stats from server
function getLevelStats(GD_level, mseg) {

	//////////// FIRST REQUEST
	// post request to the boomlings server
	request.post({
			url: 'http://www.boomlings.com/database/getGJLevels21.php',
			form: {
				gameVersion: "20",
				binaryVersion: "30",
				str: GD_level,
				total: "0",
				page: "0",
				len: "-",
				type: "0",
				secret: "Wmfd2893gb7"
			}
		},
		// returns post data
		function(err, httpResponse, body) {
			// parses response data
			if (err) {
				console.log(err + "\n" + httpResponse);
				errorOut(1, mseg);
			} else if (body == "-1") {
				errorOut(3, mseg);
			} else {

				let objectArray = formatData(body.split("#")[0].split("|")[0])

				// objectArray binds
				let LEVELID = objectArray["1"]
				let LEVELNAME = objectArray["2"]
				let AUTHORID = objectArray["6"]
				let DIFFICULTY = objectArray["9"]
				let DOWNLOADS = objectArray["10"]
				let TRACKID = objectArray["12"]
				let LIKES = objectArray["14"]
				let DEMON = objectArray["17"]
				let AUTO = objectArray["25"]
				let STARS = objectArray["18"]
				let FEATURED = objectArray["19"]
				let z = new Buffer(objectArray["3"], 'base64')
				let LEVELDESC = z.toString()
				let LENGTH = objectArray["15"]
				let COINS = objectArray["37"]
				let SONGID = objectArray["35"]
				let FEATUREDCOINS = objectArray["38"]

				let AUTHORNAME = "(unknown)" // binds authorname to unknown in case nothing is returned
				let AUTHORARRAY = body.split("#")[1].split("|") // splits authors into an array

				// iterate through authors and search for a matching userID
				for (let i = 0; i < AUTHORARRAY.length; i++) {
					if (AUTHORARRAY[i].split(":")[0] == AUTHORID) {
						AUTHORNAME = AUTHORARRAY[i].split(":")[1]
						break;
					};
				};

				let SONGNAME = "(unknown)" // binds songname as unknown in case nothing returned
				let SONGAUTHOR = "(unknown)" // binds songauthor as unknown in case nothing is returned

				// check if official song. SONGID = 0. Else grab Newgrounds song
				if (SONGID == "0") {
					SONGNAME = tracks[TRACKID][0]
					SONGAUTHOR = tracks[TRACKID][1]
				} else {
					let SONGARRAY = body.split("#")[2].split(":") // splits songs into array for later use
					// iterate through songs and search for a matching songID
					for (let i = 0; i < SONGARRAY.length; i++) {
						if (SONGARRAY[i].split("~|~")[1] == SONGID) {
							SONGNAME = SONGARRAY[i].split("~|~")[3]
							SONGAUTHOR = SONGARRAY[i].split("~|~")[7]
							break; // break the loop if match
						};
					};
				};

				// fix log crashes
				let channelName = "PRIV_MESSAGE";
				let guildName = "PRIV_MESSAGE";
				if (mseg.guild != null && mseg.channel != null) {
					channelName = mseg.channel.name;
					guildName = mseg.guild.name;
				};

				// log
				console.log("Level request by: " + mseg.author.username + " [" + mseg.author.id +
					"] || " + guildName + " [" + channelName + "] || [" + GD_level + "]"
				);

				// send to card generator
				generateLevelCard(mseg, LEVELID, LEVELNAME, LEVELDESC, AUTHORNAME, DIFFICULTY, DOWNLOADS, LIKES, DEMON, AUTO, STARS, FEATURED, LENGTH, SONGID, COINS, FEATUREDCOINS, SONGNAME, SONGAUTHOR);
			};
		});
};

// player card generator function
function generatePlayerCard(mseg, ICON, SHIP, BALL, UFO, DART, ROBOT, SPIDER, COL1, COL2, GLOW, USERNAME, COINS, USERCOINS, STARS, DEMONS, CREATORPOINTS, DIAMONDS) {

	// reads all image data
	Jimp.read("./resources/player/skeleton-player.png", function(err0, skeletonPlayer) {

		// error handling
		if (err0) {
			errorOut(2, mseg);
			console.log([err0]);
			return; // stop function execution
		} else {

			// add 0 to pre 10 values. To match plist values 01, 02, 03...
			if (parseInt(ICON) < 10) ICON = "0" + ICON;
			if (parseInt(SHIP) < 10) SHIP = "0" + SHIP;
			if (parseInt(BALL) < 10) BALL = "0" + BALL;
			if (parseInt(UFO) < 10) UFO = "0" + UFO;
			if (parseInt(DART) < 10) DART = "0" + DART;
			if (parseInt(ROBOT) < 10) ROBOT = "0" + ROBOT;
			if (parseInt(SPIDER) < 10) SPIDER = "0" + SPIDER;

			// create new blank image and pump data and pass it to the sprite generator
			let icon = new Jimp(200, 100, 0x00000000, function(err, image) {
				image = makeSprite("player_" + ICON, COL1, COL2, image).resize(42, Jimp.AUTO);
			});
			let ship = new Jimp(200, 100, 0x00000000, function(err, image) {
				image = makeSprite("ship_" + SHIP, COL1, COL2, image).resize(46, Jimp.AUTO);
			});
			let ball = new Jimp(200, 100, 0x00000000, function(err, image) {
				image = makeSprite("player_ball_" + BALL, COL1, COL2, image).resize(42, Jimp.AUTO);
			});
			let ufo = new Jimp(200, 100, 0x00000000, function(err, image) {
				image = makeSprite("bird_" + UFO, COL1, COL2, image).resize(48, Jimp.AUTO);
			});
			let wave = new Jimp(200, 100, 0x00000000, function(err, image) {
				image = makeSprite("dart_" + DART, COL1, COL2, image).resize(42, Jimp.AUTO);
			});
			let robot = new Jimp(200, 100, 0x00000000, function(err, image) {
				image = makeSprite("robot_" + ROBOT, COL1, COL2, image).resize(38, Jimp.AUTO);
			});
			let spider = new Jimp(200, 100, 0x00000000, function(err, image) {
				image = makeSprite("spider_" + SPIDER, COL1, COL2, image).resize(50, Jimp.AUTO);
			});

			// if glow add glow
			if (GLOW == "1") {
				icon = addGlow(icon, COL1, COL2); // rebind after recolor
				ship = addGlow(ship, COL1, COL2);
				ball = addGlow(ball, COL1, COL2);
				ufo = addGlow(ufo, COL1, COL2);
				wave = addGlow(wave, COL1, COL2);
				robot = addGlow(robot, COL1, COL2);
				spider = addGlow(spider, COL1, COL2);
			}

			let outputfile = "./output/" + Math.random().toString(36).substr(2, 5) + ".png" // create a random name for the output file

			//  overlay the changed drawables on top of our base.
			skeletonPlayer
				.composite(icon, 40, 64)
				.composite(ship, 98, 70)
				.composite(ball, 158, 64)
				.composite(ufo, 216, 65)
				.composite(wave, 282, 66)
				.composite(robot, 338, 65)
				.composite(spider, 388, 70)
				.print(bigFont, 2, 2, USERNAME, 478, Jimp.ALIGN_FONT_CENTER) // print some text with a custom font.
				.print(bigFont, 75, 117, STARS)
				.print(bigFont, 246, 117, USERCOINS)
				.print(bigFont, 393, 117, COINS)
				.print(bigFont, 75, 156, DIAMONDS)
				.print(bigFont, 246, 156, DEMONS)
				.print(bigFont, 393, 156, CREATORPOINTS)
				// write file
				.write(outputfile, function() {
					// upload file
					mseg.channel.uploadFile(outputfile).then(function() {
						// delete file
						fs.unlink(outputfile);
						console.log("SUCCESS: " + USERNAME);
					});
				});
		};
	});
}

var levelLengths = ["Tiny", "Short", "Medium", "Long", "XL"] // Array containing level lenght values

function generateLevelCard(mseg, LEVELID, LEVELNAME, LEVELDESC, AUTHORNAME, DIFFICULTY, DOWNLOADS, LIKES, DEMON, AUTO, STARS, FEATURED, LENGTH, SONGID, COINS, FEATUREDCOINS, SONGNAME, SONGAUTHOR) {

	// load in all images we need
	Jimp.read("./resources/level/skeleton-level.png", function(err1, skeletonLevel) {
		Jimp.read("./resources/level/difficulties.png", function(err2, difficulties) {
			Jimp.read("./resources/level/levelCoins.png", function(err3, levelCoins) {

				// error handling
				if (err1 || err2 || err3) {
					errorOut(2, mseg);
					console.log([err1, err2, err3]);
					return; // stop function execution
				} else {

					let outputfile = "./output/" + Math.random().toString(36).substr(2, 5) + ".png" // create a random name for the output file

					// Difficulty handler
					if (DEMON == "1") {
						difficulties.crop(0, 517, 86, 86); // if demon use demon
					} else if (AUTO == "1") {
						difficulties.crop(0, 604, 86, 86); // if auto use auto
					} else {
						difficulties.crop(0, (parseInt(DIFFICULTY) / 10) * 86, 86, 86); // else use other
					};

					// coins handler
					if (FEATUREDCOINS == "1") {
						levelCoins.crop(0, 0, 41, 41); // if featured coin use apropriate image
					} else {
						levelCoins.crop(0, 41, 41, 41); // if not use other image
					};
					// draw X ammount of coins
					for (let i = 0; i < parseInt(COINS); i++) {
						if (i > 2) {
							break;
						} // break if too much coins
						skeletonLevel.composite(levelCoins, 425 + (i * 25), 95);
					}

					// featured handler
					if (parseInt(FEATURED) > 0) {
						skeletonLevel.print(bigFontYellow, 655, 58, STARS); // if featured draw the stars count in yellow
					} else {
						skeletonLevel.print(bigFont, 655, 58, STARS); // if not in white
					}

					// composes image
					skeletonLevel
						.print(bigFontHD, 10, -6, LEVELNAME)
						.print(bigFontYellow, 10, 50, "by " + AUTHORNAME)
						.print(bigFont, 5, 113, LEVELID)
						.print(bigFont, 235, 80, LIKES)
						.print(bigFont, 235, 114, DOWNLOADS)
						.print(bigFont, 655, 103, levelLengths[parseInt(LENGTH)])
						.print(descriptionFont, 48, 155, LEVELDESC, 790)
						.print(bigFont, 55, 325, SONGNAME)
						.print(bigFontYellow, 55, 360, "by " + SONGAUTHOR)
						.composite(difficulties, 525, 58)
						// write file
						.write(outputfile, function() {
							// upload file
							mseg.channel.uploadFile(outputfile).then(function() {
								// delete file
								fs.unlink(outputfile);
								console.log("SUCCESS: " + LEVELNAME + "[" + LEVELID + "]")
							});
						});
				};
			});
		});
	});
};

//////////////////////////////////////////////////////
// primary color variables
var primaryR = 255
var primaryG = 255
var primaryB = 255
var primaryFlux = 20

// icon re-color function
function reColor(drawable, COL) {

	drawable.scan(0, 0, drawable.bitmap.width, drawable.bitmap.height, function(x, y, idx) {

		// check if pixel is between certain ranges. If yes execute code
		if ((this.bitmap.data[idx] >= primaryFlux && this.bitmap.data[idx] <= primaryR) && (this.bitmap.data[idx + 1] >= primaryFlux && this.bitmap.data[idx + 1] <= primaryG) && (this.bitmap.data[idx + 2] >= primaryFlux && this.bitmap.data[idx + 2] <= primaryB)) {
			this.bitmap.data[idx] = COL[0] / (primaryR / this.bitmap.data[idx]);
			this.bitmap.data[idx + 1] = COL[1] / (primaryG / this.bitmap.data[idx + 1]); // calculation to fix shading
			this.bitmap.data[idx + 2] = COL[2] / (primaryB / this.bitmap.data[idx + 2]);
		}
	});

	return drawable // returns the edited drawable
}

var glowWidth = 4 // the width of the glow in pixels

// give the image a glow outline
function addGlow(drawable, COL1, COL2) {

	// if both colors are black outline is white
	if (COL1 == "15" && COL2 == "15") {
		COL2 = "12"
	}
	// if primary secondary color is black use primary
	else if (COL2 == "15") {
		COL2 = COL1
	}

	// create new image and add the glow width to height and width
	var output = new Jimp(drawable.bitmap.width + glowWidth, drawable.bitmap.height + glowWidth, function(err, output) {

		output
			.composite(drawable, glowWidth / 2, glowWidth / 2) //place the original drawable in the middle
			.blur(glowWidth / 4) //blur it (fast blur)

			// iterate through all pixels
			.scan(0, 0, output.bitmap.width, output.bitmap.height, function(x, y, idx) {

				var alpha = this.bitmap.data[idx + 3]; // get alpha

				// if alpha is more than 10 (0-255)
				if (alpha > 10) {
					this.bitmap.data[idx + 0] = colors[COL2][0]; //replace pixel with color secondary color
					this.bitmap.data[idx + 1] = colors[COL2][1];
					this.bitmap.data[idx + 2] = colors[COL2][2];
					this.bitmap.data[idx + 3] = alpha + 60; //make pixel fuly opaque
				}
			})
			.composite(drawable, glowWidth / 2, glowWidth / 2); // place original image over edited one.
	});
	return output; // return edited
}

// parse the output data from the server
function formatData(data) {
	// Generate object from request
	let array = data.split(":") // split body into array
	let objectArray = {} // blank object
	// iterate through array and add to object
	for (let i = 0; i < array.length; i = i + 2) {
		objectArray[array[i]] = array[i + 1]
	}
	return objectArray
}

// error list
var errorString = {
	"0": "Database Error! [ USER NOT FOUND ]",
	"1": "Communication Error! [ SEE LOG ]",
	"2": "SYSTEM ERROR [ SEE LOG ]",
	"3": "Database Error! [ LEVEL NOT FOUND ]",
	"4": "Unknown Error! [ SEE LOG ]",
	"5": "USAGE `" + config.command_prefix + "stats <USERNAME>`",
	"6": "USAGE `" + config.command_prefix + "level <NAME OR ID>`"
};

// error printer
function errorOut(num, mseg) {
	if (num != null && errorString[num.toString()] != undefined) {
		mseg.channel.sendMessage(errorString[num.toString()]);
	} else {
		mseg.channel.sendMessage(errorString["4"]);
	};
};

// Express lib is used to respond to the heroku server and prevent from automatic close
function initExpress() {

	//listen on port.
	app.listen(port, function() {
		console.log('Our app is running on http://localhost:' + port); // respond on port
	});

	app.use(express.static(__dirname + '/public')); // to be able to use static content in /public directory. Such as HTML files and etc.
};

// sprite compositor. Spits out colored sprite
function makeSprite(selected, COL1, COL2, image) {

	let items = icons.filter(family, selected).reverse(); // flip the array. Main layer last

	// moves legs to end of array. Done to be drawn last.
	let legs = items.filter(findLegs, selected); // use a filter to find legs of currently selected sprite
	// skip if 0
	if (legs.length != 0) {
		legs.forEach(element => {
			items.splice(items.indexOf(element), 1); // remove legs from array
		});
		items = items.concat(legs); // add legs to end of array.
	};
	// for spider. Find the first leg and replicate it twice for back legs
	let firstLeg = items.filter(findFirstLeg, selected).reverse(); // use filter to find first leg. Flip array. Legs go behind everything
	if (firstLeg.length != 0) {
		firstLeg.forEach(element => {
			items.unshift(element.replace("001", "002")); // place in begining of array. ( back layer )
			items.unshift(element.replace("001", "003")); // use different ID for compositor
		});
	};
	// for robot. Find middle leg. Push to back.
	let middleLeg = items.filter(findMiddleLeg, selected).reverse();
	if (middleLeg.length != 0) {
		middleLeg.forEach(element => {
			items.splice(items.indexOf(element), 1);
			items.unshift(element);
		});
	};
	// find last leg. Push to back
	let lastLeg = items.filter(findLastLeg, selected).reverse();
	if (lastLeg.length != 0) {
		lastLeg.forEach(element => {
			items.splice(items.indexOf(element), 1);
			items.unshift(element);
		});
	};

	// check if extra image exists if so push extra to the end of array
	let extra = items.filter(findExtra);
	if (extra.length != 0) {
		extra.forEach(element => {
			items.splice(items.indexOf(element), 1);
		});
		items = items.concat(extra); // combine arrays
	};

	// for each part of the sprite
	items.forEach((element, i) => {
		let z = spritesheet.clone(); // clone the spritesheet

		let original = element; // for edits
		element = element.replace("002", "001").replace("003", "001"); // fix IDs for proper parsing

		let x = transform(sheetData[element].textureRect)[0][0]; // get X coord
		let y = transform(sheetData[element].textureRect)[0][1]; // get Y coord

		let sw = transform(sheetData[element].spriteSize)[0]; // get size
		let sh = transform(sheetData[element].spriteSize)[1]; // get height

		let ox = transform(sheetData[element].spriteOffset)[0]; // get offsetX
		let oy = transform(sheetData[element].spriteOffset)[1]; // get offsetY

		let w; // placeholder real width
		let h; // placeholder real height
		// rotation handling. Flips width and height.
		if (sheetData[element].textureRotated) {
			h = transform(sheetData[element].textureRect)[1][0];
			w = transform(sheetData[element].textureRect)[1][1];
		} else {
			w = transform(sheetData[element].textureRect)[1][0];
			h = transform(sheetData[element].textureRect)[1][1];
		};

		z.crop(x, y, w, h); // crop the image from the spritesheet

		// rotate cropped part
		if (sheetData[element].textureRotated) {
			z.rotate(-90);
		};
		// if back leg reduce brightness
		if (original.includes("002") || original.includes("003")) {
			z.brightness(-0.5);
		};

		// if secondary object color as secondary.
		if (element.includes("_2_001")) {
			reColor(z, colors[COL2]);
		// if primary object color as primary.
		} else if (!element.includes("_extra_") && !element.includes("_3_001")) {
			reColor(z, colors[COL1]);
		};

		// resize to true size. (sprite size)
		z.resize(sw, sh);

		// leg offset handling robot
		if (element.includes(selected + "_02_") && element.includes("robot_")) {
			ox = ox - 20 * textureScaleFactor;
			oy = oy - 10 * textureScaleFactor;
			z.rotate(45);
		} else if (element.includes(selected + "_03_") && element.includes("robot_")) {
			ox = ox - 15 * textureScaleFactor;
			oy = oy - 30 * textureScaleFactor;
			z.rotate(-45);
		} else if (element.includes(selected + "_04_") && element.includes("robot_")) {
			ox = ox;
			oy = oy - 32 * textureScaleFactor;
		};

		// leg offset handling spider
		if (element.includes(selected + "_02_") && element.includes("spider_") && original.includes("002")) {
			ox = ox + 9 * textureScaleFactor;
			oy = oy - 19 * textureScaleFactor;
		} else if (element.includes(selected + "_02_") && element.includes("spider_") && original.includes("003")) {
			ox = ox + 29 * textureScaleFactor;
			oy = oy - 19 * textureScaleFactor;
			z.flip(true, false);
		} else if (element.includes(selected + "_02_") && element.includes("spider_")) {
			ox = ox - 8 * textureScaleFactor;
			oy = oy - 19 * textureScaleFactor;
		} else if (element.includes(selected + "_03_") && element.includes("spider_")) {
			ox = ox - 43 * textureScaleFactor;
			oy = oy - 19 * textureScaleFactor;

			// crap spider is crap. Hardcoding Ik Ik. I dislike it too.
			if (selected == "spider_07") {
				ox = ox + 10 * textureScaleFactor;
				oy = oy + 8 * textureScaleFactor;
			}
			// crap layer 2 handling. (details on spider legs and such)
			if (h < 11 * textureScaleFactor) {
				ox = ox + 10 * textureScaleFactor;
			} else if (h < 20 * textureScaleFactor && w < 14 * textureScaleFactor) {
				ox = ox + 9 * textureScaleFactor;
				oy = oy - 4 * textureScaleFactor;
			};
			z.rotate(45);
		// 4th robot leg
		} else if (element.includes(selected + "_04_") && element.includes("spider_")) {
			ox = ox - 15 * textureScaleFactor;
			oy = oy - 10 * textureScaleFactor;
		};

		// devide by two to (center of sprite)
		let px = sw / 2;
		let py = sh / 2;

		// composite part on image.
		image.composite(z, 100 - px + ox, 50 - py - oy);
	});
	return image.autocrop(); // return finished image after autocrop (remove blank space)
};
// filter out glow
function removeGlow(value) {
	return !value.includes("_glow_");
};
// filter out everything but related parts.
function family(value) {
	return value.includes(this);
};
// find extra items
function findExtra(value) {
	return value.includes("_extra_");
};
// filter out legs
function findLegs(value) {
	return (value.includes(this + "_02_") && (value.includes("robot_") || value.includes("spider_"))) ||
		(value.includes(this + "_03_") && (value.includes("robot_") || value.includes("spider_"))) ||
		(value.includes(this + "_04_") && (value.includes("robot_") || value.includes("spider_")));
};
// filter middle leg
function findMiddleLeg(value) {
	return value.includes(this + "_03_") && value.includes("robot_");
}
// filter first leg
function findFirstLeg(value) {
	return value.includes(this + "_02_") && value.includes("spider_") && !value.includes("extra");
}
// filter last leg
function findLastLeg(value) {
	return value.includes(this + "_04_") && value.includes("spider_");
}
// transform weird coordinates into array
function transform(val) {
	return JSON.parse(val.replace(/{/g, "[").replace(/}/g, "]"));
};
