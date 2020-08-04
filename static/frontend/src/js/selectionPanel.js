
class SelectionPanel {

    constructor(config, dataFilter, eventHandler, colorScheme) {

        this.config = config;
        this.eventHandler = eventHandler;
        this.dataFilter = dataFilter;
        this.colorScheme = colorScheme;
        this.buttons = [];
        this.init();
    }


    init(){
        var that = this;

        //the display to add buttons to
        that.selectionDisplay = d3.select('#selection_display');
        that.selectionDisplay.attr('class', "text-center");

        //deactive all buttons except the input one
        that.buttons.deactivateOthers = function(button){
            that.buttons.forEach(function(d){
                if (d != button) {
                    d.classed('active', false);
                }
            })
        }

        //deactive all buttons
        that.buttons.deactivateAll = function(){
            that.buttons.forEach(function(d){
                d.classed('active', false);
            })
        }

        //check if any selection (button) is active
        that.buttons.isSelectionActive = function(){
            that.buttons.forEach(function(d){
                if (d.classed('active')){
                    return true;
                };
            })
            return false;
        }

        //toggle a button (de)active (and deactivate all others)
        that.buttons.toggleButton = function(button){
            that.buttons.deactivateOthers(button);
            button.classed("active", !button.classed("active"));
        }


        //LASSO POLYGON SELECTION
        that.lassoButton = that.selectionDisplay
            .append("div")
            .attr('id', "lasso")
            .attr('class', 'selection_button')
            .style("background-image", "url('/static/frontend/src/css/images/noun_Lasso_1471841.svg')");
        that.lassoButton
            .on('click', function(){
                that.buttons.toggleButton(that.lassoButton);
                eventHandler.trigger(SelectionPanel.events.SELECTION, {selectionType: "lasso", active: that.lassoButton.classed("active")});
            });
        that.buttons.push(that.lassoButton);


        //RECTANGLE SELECTION
        that.rectangleButton = that.selectionDisplay
            .append("div")
            .attr('id', "rectangle")
            .attr('class', 'selection_button')
            .style("background-image", "url('/static/frontend/src/css/images/noun_selection_486963.svg')")
         that.rectangleButton
             .on('click', function(){
                that.buttons.toggleButton(that.rectangleButton);
                eventHandler.trigger(SelectionPanel.events.SELECTION, {selectionType: "rectangle", active: that.rectangleButton.classed("active")});
            });
        that.buttons.push(that.rectangleButton);


        //MAGNET POLYGON SELECTION
        that.magnetButton =  that.selectionDisplay
            .append("div")
            .attr('id', "magnet")
            .attr('class', 'selection_button')
            .style("background-image", "url('/static/frontend/src/css/images/noun_Magnet_3454467.svg')")
        that.magnetButton
            .on('click', function(){
                that.buttons.toggleButton(that.magnetButton);
                eventHandler.trigger(SelectionPanel.events.SELECTION, {selectionType: "magnet", active: that.magnetButton.classed("active")});
            });
        that.buttons.push(that.magnetButton);



        //MAGIC WAND SELECTION
        that.wandButton =  that.selectionDisplay
            .append("div")
            .attr('id', "magnet")
            .attr('class', 'selection_button')
            .style("background-image", "url('/static/frontend/src/css/images/noun_wand_2845160.svg')")
        that.wandButton
            .on('click', function(){
                that.buttons.toggleButton(that.wandButton);
                eventHandler.trigger(SelectionPanel.events.SELECTION, {selectionType: "wand", active: that.wandButton.classed("active")});
            });
        that.buttons.push(that.wandButton);


        //DEACTIVATE SELECTION BUTTON
        that.deactivateButton = that.selectionDisplay
            .append("div")
            .attr('id', "lasso")
            .attr('class', 'selection_button')
            .style("background-image", "url('/static/frontend/src/css/images/noun_clear_487123.svg')");
        that.deactivateButton
            .on('click', function(){
                that.buttons.deactivateAll();
                eventHandler.trigger(SelectionPanel.events.CLEARSELECTION);
                eventHandler.trigger(SelectionPanel.events.SELECTION, {selectionType: "clear", active: false});
            });
        that.buttons.push(that.deactivateButton);
    }


}

//the Selection Events
SelectionPanel.events = {
    SELECTION: "SELECTION",
    CLEARSELECTION: "CLEARSELECTION"
};