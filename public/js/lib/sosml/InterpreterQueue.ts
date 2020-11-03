import escapeHTML from 'lodash/escape'

export default class InterpreterQueue {

    //timeout: number;
    queue: Array<[string,HTMLElement,number]>; //code,element,timeout
    worker: Worker
    timeoutID: number
    busy:boolean
    code: string
    result: string
    element: HTMLElement

    render(result: string,elem:HTMLElement){

        let text = ''
        
        result.split("\n").forEach(line => {

            let escaped = escapeHTML(line.replace(/\\/g, ''))

            if (escaped.startsWith("Printed:")) {
                text += escaped + "\n"
            } else {
                if (escaped.startsWith("1") || escaped.startsWith("2")) {
                    escaped = escaped.substring(1)
                }
                if(escaped.startsWith("3")) {
                    escaped = escaped.substring(1)
                    elem.style.background = "#f8d7da"
                } else {
                    elem.style.background = "#d4edda"
                }
                if(escaped.includes("&quot") && escaped.match(/&quot/g).length == 2) {
                    let segments = escaped.split("&quot;")
                    segments[0] = segments[0].replace("*","<strong>")
                    segments[1] = "&quot;" + segments[1]+ "&quot;"
                    segments[2] = segments[2].replace("*","</strong>").replace("_","<i>").replace("_","</i>")
                    text += segments.join('') + "\n"
                } else {
                    text += escaped.replace("*","<strong>").replace("*","</strong>").replace("_","<i>").replace("_","</i>") + "\n"
                }

            }
        });
        elem.innerHTML = text.slice(0,-1)

    }

    deferInterpretation(code:string,elem:HTMLElement,timeout:number){
        this.queue.push([code,elem,timeout])
        this.schedule()
    }

    init(){
        if(this.timeoutID) {
            clearTimeout(this.timeoutID);
        }
        this.busy = false
        this.queue = []
        this.result, this.code = ""
        if (this.worker) {
            this.worker.terminate()
        }
        this.worker = new Worker('build/sosmlwebworker.js')
        this.worker.onmessage = this.workerMessageRecieved.bind(this)
        this.worker.postMessage({type:"clear",data:""})
        
        this.worker.postMessage({type:"settings",data:`
        {"allowUnicodeInStrings":true,"allowUnicode":false,"allowUnicodeTypeVariables":true,
        "showTypeVariablesAsUnicode":false,"allowSuccessorML":false,"disableElaboration":false,
        "disableEvaluation":false,"allowVector":true,"allowLongFunctionNames":false,"allowStructuresAnywhere":false,
        "allowSignaturesAnywhere":false,"allowFunctorsAnywhere":false,"strictMode":true,"realEquality":false}`});
    
    }

    schedule(){
        if(!this.busy && this.queue.length > 0){
            this.busy = true
            let newdata = this.queue.pop()

            this.code = newdata[0]
            this.element = newdata[1]
            this.result = ""

            this.worker.postMessage({
                type:"interpret",
                data:{added:this.code.split('\n'),
                pos:{line:0,ch:0,sicky:null},
                removed:[""]}})
            
                this.timeoutID = window.setTimeout(() => {
                    this.worker.terminate();
                    this.element.style.background = "#fff3cd"
                    this.element.innerHTML = "Time Limit Violation"
                    this.worker = new Worker('build/sosmlwebworker.js');
                    this.worker.onmessage = this.workerMessageRecieved.bind(this)
                    this.busy = false
                    this.schedule()
                }, newdata[2]);
        }
    }

    jobHasFinished(){
        clearTimeout(this.timeoutID);
        this.render(this.result,this.element)
        this.busy = false;
        this.schedule()
    }

    workerMessageRecieved(event: MessageEvent){
        if (event.data.type === "getcode") {
            this.worker.postMessage({
                type: "code",
                data: this.code
            }) 
        } else if (event.data.type === "partial"){
            this.result += event.data.data
        } else if (event.data.type === "finished"){
            this.jobHasFinished()
        }

    }
    
}