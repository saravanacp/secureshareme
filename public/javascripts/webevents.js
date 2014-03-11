var events = new Array();

function eventConstructor(name, timestamp, data)
{
this.name=name;
this.timestamp=timestamp;
this.data=data;
}

//Core function
function event_reactor(event_name, event_type, src_obj_id, reactor_name, data_obj_ids) {
	
	$(src_obj_id).on(event_type, function(event){
		var data_values = data_obj_ids.map( function(item) { 
			if ($(item).is("input")) {
				return $(item).val();
			}
			else
				return;
			} );
		var ts = getTimeStamp();
		var ev = new eventConstructor(event_name,ts,data_values);		
		window[reactor_name](ev);
	});
	
}

//Write new react functions as per your requirement
function example_new_reactor(ev) {
	//Do what you want!
}

function ajax_post_reactor(ev) {
	$.ajax({
        url: "/webEvent",
        type: "POST",
        data: {
            "eventName": ev.name,
            "eventTime": ev.timestamp,
            "eventData": ev.data
        },
        success: function (ajax_response) {
            	console.log("Webevent sent to server");
        }
    });
}

//Our implementation for a simple console logging react
function logging_reactor(ev) {
	console.log("Event time: " + ev.timestamp + "\nEvent name: " + ev.name + "\nEvent data: " + ev.data);
}

//Our implementation for a simple remember logging react
function remember_reactor(ev) {	
	events.push(ev);
	console.log("Total events:  " + events.length + ". Just added event: " + ev.name + "|" + ev.timestamp + "|" + ev.data);
}

//Utility
function getTimeStamp() {
    var now = new Date();
    return ((now.getMonth() + 1) + '/' +
            (now.getDate()) + '/' +
             now.getFullYear() + " " +
             now.getHours() + ':' +
             ((now.getMinutes() < 10)
                 ? ("0" + now.getMinutes())
                 : (now.getMinutes())) + ':' +
             ((now.getSeconds() < 10)
                 ? ("0" + now.getSeconds())
                 : (now.getSeconds())));
}