var bus = new Vue();

Vue.component("options", {
    props: ["pnum"],
    data: function () { return {
        id_counter: 0,
        options: [],
    }},
    methods: {
        add_option: function (event) {
            const id = this.new_id();
            if (this.options.length == 0) {
                this.options.push({
                    id: id,
                    name: "option " + id,
                    probability: 100.0,
                    value: 0.0,
                });
            } else {
                this.options.push({
                    id: id,
                    name: "option " + id,
                    probability: 0.0,
                    value: 0.0,
                });
            }

            this.send_update_options();
            this.$nextTick(() => this.$refs["opt"+id][0].select());
        },
        remove_option: function (opt, event) {
            const index = this.options.indexOf(opt);
            this.options.splice(index, 1);
            this.send_update_options();
        },
        new_id: function (event) {
            const id = this.id_counter;
            this.id_counter += 1;
            return id;
        },
        send_update_options: function () {
            bus.$emit("update-options", {new_options: this.options, pnum: this.pnum});
        },
        reshape_probs: function (id) { // need to assure probabilities sum to 100
            let probs = {};
            let prob_sum = 0;
            this.options.forEach(opt => {
                const p = Number(opt.probability);
                probs[opt.id] = p;
                prob_sum += p;
            });
            const change_needed = 100 - prob_sum;
            const can_change_sum = prob_sum - probs[id];

            if (can_change_sum === 0) { // if all other options are zero, we can't scale them, so evenly add to them.
                console.log("not scale");
                this.options.forEach(opt => {
                    const n = Object.keys(probs).length - 1;
                    if (opt.id != id) {
                        opt.probability = Number(opt.probability) + change_needed / n;
                    }
                });
            } else { // Scale options
                console.log("scale");
                this.options.forEach(opt => {
                    if (opt.id != id) {
                        const p = Number(opt.probability);
                        opt.probability = p + change_needed * p / can_change_sum;
                        console.log("change needed: " + change_needed)
                        console.log("set " + opt.id + " to " + p);
                    }
                });
            }

            this.send_update_options();
        },
        format: function(val) {
            return Number(val).toFixed(2);
        }
    },
    template: 
`<div>
    <button v-on:click="add_option()">+</button>
    <div v-for="option in options" v-bind:key="option.id">
        <input 
            type=text size=5 :ref="'opt'+option.id"  v-model="option.name"
            :placeholder="\'option \' + option.id"
            v-on:change="send_update_options()">
        </input>
        <input style="width:40px;"
            type=number v-model="option.value"
            placeholder="0" v-on:change="send_update_options()">
        </input>
        <input type=range v-on:change="reshape_probs(option.id)" min=0 max=100 v-model="option.probability" :ref="'prob'+option.id"></input>
        {{ format(option.probability) }}
        <button v-on:click="remove_option(option)">-</button>
    </div>
</div>`
});

Vue.component("valuegrid", {
    data: function () { return {
        // player 1 is along the top, player 2 is along the side
        // stored as a list of rows
        p1_options: [],
        p2_options: [],
        grid: {},
    }},
    methods: {
        update_options: function (ev) {
            if (ev.pnum == 1) {
                this.p1_options = ev.new_options;
            } else {
                this.p2_options = ev.new_options;
            }
        },
        update_grid: function(info) {
            this.grid[info.p1optid * 4096 + info.p2optid] = info.set;
            bus.$emit("update-grid", this.grid);
        }
    },
    created() {
        bus.$on("update-options", this.update_options);
        bus.$on("option-win-set", this.update_grid);
    },
    template: 
`<div>
    <div v-for="p2opt in p2_options" v-bind:key="p2opt.id" class="vgrow"> 
        <playercheck v-for="p1opt in p1_options" v-bind:key="p1opt.id" :p1optid="p1opt.id" :p2optid="p2opt.id"></playercheck>
        <span class="vgp2name">{{ p2opt.name }}</span>
    </div>
    <span class="vgp1name" v-for="p1opt in p1_options">{{ p1opt.name }}</span>
</div>`
});

Vue.component("playercheck", {
    props: ["p1optid", "p2optid"],
    data: function () { return {
        set: 0, // -1 for p2, 1 for p1
        style: "background-color:lightgray;",
    }},
    methods: {
        onclick: function (event) {
            if (event.button === 0) { // left
                this.set = 1;
                this.style="background:url(./images/downarrow.png),dodgerblue;";
            } else if (event.button === 1) { // middle
                this.set = 0;
                this.style="background-color:lightgray;";
            } else if (event.button === 2) { // right
                this.set = -1;
                this.style="background:url(./images/rightarrow.png),orange;";
            }

            bus.$emit("option-win-set", {p1optid: this.p1optid, p2optid: this.p2optid, set: this.set});
        }
    },
    template: 
`<button class="playercheck" :style="style" oncontextmenu="return false;" v-on:mousedown="onclick($event)"></button>`
});

Vue.component("values", {
    data: function () { return {
        p1_options: [],
        p2_options: [],
        grid: {},
        EV: 0.0,
    }},
    methods: {
        update_options: function (ev) {
            if (ev.pnum == 1) {
                this.p1_options = ev.new_options;
            } else {
                this.p2_options = ev.new_options;
            }
            this.update_values();
        },
        update_grid: function (grid) {
            this.grid = grid;
            this.update_values();
        },
        update_values: function() {
            var ev = 0;
            this.p1_options.forEach(p1opt => this.p2_options.forEach(p2opt => {
                const set = this.grid[p1opt.id * 4096 + p2opt.id];
                let v;
                if (set === 0) {
                    v = 0;
                } else if (set === 1) {
                    v = p1opt.value;
                } else {
                    v = -p2opt.value;
                }

                ev += v * p1opt.probability * p2opt.probability / 10000;
            }));
            this.EV = ev;
        },
        format: function(val) {
            return val.toFixed(2);
        }
    },
    created() {
        bus.$on("update-options", this.update_options);
        bus.$on("update-grid", this.update_grid);
    },
    template: `<div> Expected value: {{ format(EV) }}<br> </div>`
});

var app = new Vue({
    el: "#app",
});
